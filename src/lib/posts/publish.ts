import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, categories, postLocales, posts, redirects } from "@/lib/db/schema";
import { tags } from "@/lib/cache/tags";
import { href } from "@/lib/seo/routes";
import { enqueueIndexNow } from "@/lib/indexnow/queue";

export type Revalidator = (tagList: string[]) => Promise<void> | void;

/** Tags touched by a post locale (post, lists, sitemap, feed). */
export function tagsFor(row: { postId: string; locale: string; slug: string }) {
  return [tags.post(row.postId), tags.posts(row.locale), `post-slug:${row.locale}:${row.slug}`, tags.sitemap, tags.feed(row.locale)];
}

/** Public paths that change when a post is (un)published. */
export async function affectedPaths(row: { postId: string; locale: "tr" | "en"; slug: string }) {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, row.postId), with: { category: true } });
  const cat = post?.category;
  return [
    href(row.locale, "post", { slug: row.slug }),
    href(row.locale, "home"),
    ...(cat ? [href(row.locale, "category", { slug: row.locale === "en" ? cat.slugEn : cat.slugTr })] : []),
  ];
}

/**
 * Flip a locale row to `published` (used by the manual action and the scheduler),
 * revalidate, and queue IndexNow. Idempotent.
 */
export async function finalizePublish(localeId: string, actor: string, revalidate: Revalidator) {
  const row = await db.query.postLocales.findFirst({ where: eq(postLocales.id, localeId) });
  if (!row) throw new Error("post locale not found");
  if (row.status === "published") return row;
  await db.transaction(async (tx) => {
    await tx
      .update(postLocales)
      .set({ status: "published", publishedAt: row.publishedAt ?? new Date(), scheduledAt: null, unpublishedAt: null, updatedAt: new Date() })
      .where(eq(postLocales.id, localeId));
    await tx.delete(redirects).where(and(eq(redirects.postLocaleId, localeId), eq(redirects.statusCode, 410)));
    await tx.insert(auditLog).values({ actor, action: "post.publish", entity: "post_locale", entityId: localeId });
  });
  await revalidate([...tagsFor(row), tags.redirects]);
  // Page is live now. IndexNow (post + lists) after a short delay; the AI pipeline (embed → link → reverse link)
  // runs in the background and re-submits the post URL with the 10-minute debounce when links were applied.
  await enqueueIndexNow(await affectedPaths(row), "publish", 60);
  try {
    const { getBoss, QUEUES } = await import("@/lib/jobs/boss");
    await getBoss().send(QUEUES.postPublished, { localeId }, { singletonKey: `published:${localeId}`, retryLimit: 3, retryBackoff: true });
  } catch (e) {
    console.error(JSON.stringify({ level: "error", src: "publish", msg: "enqueue post.published failed", err: e instanceof Error ? e.message : String(e) }));
  }
  return { ...row, status: "published" as const };
}

export { categories };
