import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { indexnowQueue } from "@/lib/db/schema";
import { absolute } from "@/lib/seo/routes";

export type IndexNowAction = "publish" | "update" | "delete" | "redirect";
const RANK: Record<IndexNowAction, number> = { update: 1, redirect: 2, publish: 3, delete: 4 };

/** Only canonical public paths (never admin/search/paginated/query URLs). */
function isSubmittable(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("/admin") || path.startsWith("/api") || path.includes("?") || path.startsWith("/tr/")) return false;
  if (/\/(sayfa|page)\/\d+/.test(path) || path.startsWith("/arama") || path.startsWith("/en/search")) return false;
  return true;
}

/** Upsert URLs into the queue; a stronger action wins, not_before keeps the earliest. */
export async function enqueueIndexNow(paths: string[], action: IndexNowAction, delaySeconds = 0) {
  const urls = Array.from(new Set(paths.filter(isSubmittable).map((p) => absolute(p))));
  if (urls.length === 0) return 0;
  const notBefore = new Date(Date.now() + delaySeconds * 1000);
  for (const url of urls) {
    await db
      .insert(indexnowQueue)
      .values({ url, action, notBefore })
      .onConflictDoUpdate({
        target: indexnowQueue.url,
        set: {
          notBefore: sql`LEAST(${indexnowQueue.notBefore}, ${notBefore})`,
          action: sql`CASE WHEN ${RANK[action]} > (CASE ${indexnowQueue.action} WHEN 'update' THEN 1 WHEN 'redirect' THEN 2 WHEN 'publish' THEN 3 ELSE 4 END) THEN ${action}::indexnow_action ELSE ${indexnowQueue.action} END`,
        },
      });
  }
  return urls.length;
}
