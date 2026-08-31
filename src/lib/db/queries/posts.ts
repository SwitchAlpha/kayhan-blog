import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "../client";
import { categories, media, postLocales, posts, type Locale } from "../schema";
import { tags } from "@/lib/cache/tags";

export type PostCard = {
  id: string;
  postId: string;
  slug: string;
  title: string;
  summary: string;
  publishedAt: Date | null;
  readingTimeSec: number;
  category: { slugTr: string; slugEn: string; nameTr: string; nameEn: string };
  cover: { variants: { w: number; key: string; bytes: number }[]; width: number; height: number; blurDataUrl: string | null; altTr: string | null; altEn: string | null } | null;
};

const PAGE_SIZE = 12;

/** unstable_cache round-trips through JSON: revive Date columns. */
function reviveDate<T>(v: T): T extends null ? null : Date {
  return (v === null || v === undefined ? null : new Date(v as unknown as string)) as T extends null ? null : Date;
}

export const getPublishedPosts = async (locale: Locale, page = 1) => {
  const r = await unstable_cache(
    async () => {
      const rows = await db
        .select({
          id: postLocales.id, postId: postLocales.postId, slug: postLocales.slug, title: postLocales.title, summary: postLocales.summary,
          publishedAt: postLocales.publishedAt, readingTimeSec: postLocales.readingTimeSec,
          category: { slugTr: categories.slugTr, slugEn: categories.slugEn, nameTr: categories.nameTr, nameEn: categories.nameEn },
          cover: { variants: media.variants, width: media.width, height: media.height, blurDataUrl: media.blurDataUrl, altTr: media.altTr, altEn: media.altEn },
        })
        .from(postLocales)
        .innerJoin(posts, eq(posts.id, postLocales.postId))
        .innerJoin(categories, eq(categories.id, posts.categoryId))
        .leftJoin(media, eq(media.id, posts.coverMediaId))
        .where(and(eq(postLocales.locale, locale), eq(postLocales.status, "published"), sql`${postLocales.publishedAt} <= now()`))
        .orderBy(desc(postLocales.publishedAt))
        .limit(PAGE_SIZE + 1)
        .offset((page - 1) * PAGE_SIZE);
      return { items: rows.slice(0, PAGE_SIZE) as PostCard[], hasMore: rows.length > PAGE_SIZE };
    },
    ["published-posts", locale, String(page)],
    { tags: [tags.posts(locale)] },
  )();
  return { ...r, items: r.items.map((p) => ({ ...p, publishedAt: reviveDate(p.publishedAt) })) };
};

export const getPublishedPostBySlug = async (locale: Locale, slug: string) => {
  const row = await unstable_cache(
    async () => {
      const row = await db.query.postLocales.findFirst({
        where: and(eq(postLocales.locale, locale), eq(postLocales.slug, slug), eq(postLocales.status, "published"), sql`${postLocales.publishedAt} <= now()`),
        with: { post: { with: { category: true, cover: true } } },
      });
      return row ?? null;
    },
    ["post-by-slug", locale, slug],
    { tags: [tags.posts(locale), `post-slug:${locale}:${slug}`] },
  )();
  if (!row) return null;
  return {
    ...row,
    publishedAt: reviveDate(row.publishedAt), contentUpdatedAt: reviveDate(row.contentUpdatedAt), scheduledAt: reviveDate(row.scheduledAt),
    unpublishedAt: reviveDate(row.unpublishedAt), createdAt: reviveDate(row.createdAt), updatedAt: reviveDate(row.updatedAt),
  };
};

/** Admin (uncached) */
export async function listPostsForAdmin() {
  return db
    .select({
      id: postLocales.id, postId: postLocales.postId, locale: postLocales.locale, slug: postLocales.slug, title: postLocales.title,
      status: postLocales.status, publishedAt: postLocales.publishedAt, scheduledAt: postLocales.scheduledAt, updatedAt: postLocales.updatedAt,
      wordCount: postLocales.wordCount, categoryName: categories.nameTr,
    })
    .from(postLocales)
    .innerJoin(posts, eq(posts.id, postLocales.postId))
    .innerJoin(categories, eq(categories.id, posts.categoryId))
    .orderBy(desc(postLocales.updatedAt));
}

export async function getPostLocaleForAdmin(id: string) {
  return db.query.postLocales.findFirst({ where: eq(postLocales.id, id), with: { post: { with: { category: true, cover: true, postTags: { with: { tag: true } } } } } });
}
