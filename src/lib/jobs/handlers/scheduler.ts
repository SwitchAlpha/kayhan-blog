import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { postLocales } from "@/lib/db/schema";
import { finalizePublish } from "@/lib/posts/publish";
import { revalidateViaLoopback } from "@/lib/cache/revalidate";

/** Runs every minute: publish posts whose scheduled_at has passed. Idempotent (status flip guarded). */
export async function schedulerTick() {
  const due = await db
    .select({ id: postLocales.id })
    .from(postLocales)
    .where(and(eq(postLocales.status, "scheduled"), lte(postLocales.scheduledAt, sql`now()`)))
    .limit(20);
  const published: string[] = [];
  for (const { id } of due) {
    try {
      await finalizePublish(id, "scheduler", revalidateViaLoopback);
      published.push(id);
    } catch (e) {
      console.error(JSON.stringify({ level: "error", src: "scheduler", id, msg: e instanceof Error ? e.message : String(e) }));
    }
  }
  return { published };
}
