import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, lte, or, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { indexnowQueue, indexnowSubmissions, settings } from "@/lib/db/schema";
import { SITE_URL } from "@/lib/seo/routes";

const ENDPOINT = process.env.INDEXNOW_ENDPOINT ?? "https://api.indexnow.org/indexnow";
const MAX_BATCH = 500;
const DEBOUNCE_MS = 10 * 60 * 1000; // Yandex/IndexNow: don't resubmit the same URL within ~10 min
const DAILY_CAP = 200;

async function setting<T>(key: string): Promise<T | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return (row?.value as T) ?? null;
}
async function putSetting(key: string, value: unknown) {
  await db.insert(settings).values({ key, value: value as object, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value: value as object, updatedAt: new Date() } });
}

export type DrainResult = { submitted: number; skipped: string; status?: number };

/** Called by the pg-boss cron every 2 minutes. Idempotent; honours Retry-After and a daily cap. */
export async function drainIndexNow(): Promise<DrainResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || process.env.NODE_ENV !== "production") return { submitted: 0, skipped: "disabled (no key or not production)" };
  if ((await setting<boolean>("indexnow.enabled")) === false) return { submitted: 0, skipped: "disabled by settings" };
  const backoff = await setting<string>("indexnow.backoff_until");
  if (backoff && new Date(backoff) > new Date()) return { submitted: 0, skipped: `backoff until ${backoff}` };

  const since = new Date(Date.now() - 86_400_000);
  const [{ n }] = await db.select({ n: sql<number>`coalesce(sum(jsonb_array_length(${indexnowSubmissions.urls})),0)` }).from(indexnowSubmissions).where(and(gt(indexnowSubmissions.submittedAt, since), lte(indexnowSubmissions.httpStatus, 299)));
  if (Number(n) >= DAILY_CAP) return { submitted: 0, skipped: "daily cap reached" };

  // Candidates: due, and not submitted in the last 10 minutes (unless delete)
  const recent = new Date(Date.now() - DEBOUNCE_MS);
  const rows = await db
    .select()
    .from(indexnowQueue)
    .where(and(lte(indexnowQueue.notBefore, new Date()), or(isNull(indexnowQueue.lastError), sql`true`)))
    .orderBy(indexnowQueue.notBefore)
    .limit(MAX_BATCH);
  const recentlySent = new Set(
    (await db.select({ urls: indexnowSubmissions.urls }).from(indexnowSubmissions).where(and(gt(indexnowSubmissions.submittedAt, recent), lte(indexnowSubmissions.httpStatus, 299)))).flatMap((r) => r.urls),
  );
  const batch = rows.filter((r) => r.action === "delete" || !recentlySent.has(r.url));
  if (batch.length === 0) return { submitted: 0, skipped: "nothing due" };

  const urlList = batch.map((r) => r.url);
  const host = new URL(SITE_URL).host;
  const batchId = randomUUID();
  let status = 0;
  let body = "";
  let retryAfterAt: Date | null = null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList }),
      signal: AbortSignal.timeout(15_000),
    });
    status = res.status;
    body = (await res.text()).slice(0, 2000);
    if (status === 429) {
      const ra = Number(res.headers.get("retry-after") ?? "900");
      retryAfterAt = new Date(Date.now() + (Number.isFinite(ra) ? ra : 900) * 1000);
    }
  } catch (e) {
    status = 0;
    body = e instanceof Error ? e.message : "network error";
  }
  await db.insert(indexnowSubmissions).values({ batchId, urls: urlList, httpStatus: status || null, responseBody: body, retryAfterAt });

  if (status === 200 || status === 202) {
    await db.delete(indexnowQueue).where(sql`${indexnowQueue.url} = ANY(${urlList})`);
    return { submitted: urlList.length, skipped: "", status };
  }
  if (status === 429 && retryAfterAt) {
    await putSetting("indexnow.backoff_until", retryAfterAt.toISOString());
    return { submitted: 0, skipped: `429 → backoff until ${retryAfterAt.toISOString()}`, status };
  }
  if (status === 400 || status === 403 || status === 422) {
    // configuration error: pause and surface in admin
    await putSetting("indexnow.enabled", false);
    await putSetting("indexnow.paused_reason", `${status}: ${body}`);
    return { submitted: 0, skipped: `config error ${status}, paused`, status };
  }
  // network / 5xx: backoff per URL
  await db
    .update(indexnowQueue)
    .set({ attempts: sql`${indexnowQueue.attempts} + 1`, lastError: body.slice(0, 500), notBefore: new Date(Date.now() + 5 * 60_000) })
    .where(sql`${indexnowQueue.url} = ANY(${urlList})`);
  await db.delete(indexnowQueue).where(gt(indexnowQueue.attempts, 8));
  return { submitted: 0, skipped: `transient ${status}`, status };
}

export async function listSubmissions(limit = 50) {
  return db.select().from(indexnowSubmissions).orderBy(desc(indexnowSubmissions.submittedAt)).limit(limit);
}
export async function listQueue() {
  return db.select().from(indexnowQueue).orderBy(indexnowQueue.notBefore).limit(200);
}
