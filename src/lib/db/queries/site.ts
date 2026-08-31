import "server-only";
import { and, desc, eq, sql, count } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "../client";
import { categories, media, pages, postLocales, postTags, posts, tags as tagsTable, type Locale } from "../schema";
import { tags } from "@/lib/cache/tags";
import type { PostCard } from "./posts";

const PAGE_SIZE = 12;
const revive = (d: unknown) => (d ? new Date(d as string) : null);

export const PAGE_KEYS = ["about", "contact", "privacy", "cookies", "disclosure"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export const getPage = async (locale: Locale, key: PageKey) =>
  unstable_cache(async () => (await db.query.pages.findFirst({ where: and(eq(pages.key, key), eq(pages.locale, locale)) })) ?? null, ["page", locale, key], { tags: [tags.page(key)] })();

export const getCategories = async () =>
  unstable_cache(async () => db.select().from(categories).orderBy(categories.sort, categories.nameTr), ["categories"], { tags: [tags.posts("tr"), tags.posts("en")] })();

async function listByFilter(locale: Locale, page: number, where: ReturnType<typeof and>) {
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
    .where(and(eq(postLocales.locale, locale), eq(postLocales.status, "published"), sql`${postLocales.publishedAt} <= now()`, where))
    .orderBy(desc(postLocales.publishedAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return { items: rows.slice(0, PAGE_SIZE) as PostCard[], hasMore: rows.length > PAGE_SIZE };
}

export const getCategoryPage = async (locale: Locale, slug: string, page: number) => {
  const r = await unstable_cache(
    async () => {
      const cat = await db.query.categories.findFirst({ where: eq(locale === "en" ? categories.slugEn : categories.slugTr, slug) });
      if (!cat) return null;
      const list = await listByFilter(locale, page, eq(posts.categoryId, cat.id));
      return { category: cat, ...list };
    },
    ["category-page", locale, slug, String(page)],
    { tags: [tags.posts(locale)] },
  )();
  return r && { ...r, items: r.items.map((p) => ({ ...p, publishedAt: revive(p.publishedAt) })) };
};

export const getTagPage = async (locale: Locale, slug: string, page: number) => {
  const r = await unstable_cache(
    async () => {
      const tag = await db.query.tags.findFirst({ where: eq(locale === "en" ? tagsTable.slugEn : tagsTable.slugTr, slug) });
      if (!tag) return null;
      const [{ total }] = await db
        .select({ total: count() })
        .from(postTags)
        .innerJoin(postLocales, and(eq(postLocales.postId, postTags.postId), eq(postLocales.locale, locale), eq(postLocales.status, "published")))
        .where(eq(postTags.tagId, tag.id));
      const list = await listByFilter(locale, page, sql`${posts.id} IN (SELECT post_id FROM post_tags WHERE tag_id = ${tag.id})`);
      return { tag, total: Number(total), ...list };
    },
    ["tag-page", locale, slug, String(page)],
    { tags: [tags.posts(locale)] },
  )();
  return r && { ...r, items: r.items.map((p) => ({ ...p, publishedAt: revive(p.publishedAt) })) };
};

/** Full-text search (TR: normalized + folded chain; EN: english config). Not cached. */
export async function searchPosts(locale: Locale, q: string, limit = 20) {
  const query = q.normalize("NFC").replace(/[&|!:*()<>'"\\]/g, " ").trim().slice(0, 100);
  if (!query) return [];
  const tsq = locale === "en" ? sql`websearch_to_tsquery('english', ${query})` : sql`tsq_fold(websearch_to_tsquery('turkish', tr_norm(${query})))`;
  const rows = await db.execute(sql`
    SELECT pl.id, pl.slug, pl.title, pl.summary, pl.published_at AS "publishedAt",
           ts_rank_cd(pl.search_tsv, ${tsq}, 32) AS rank
    FROM post_locales pl
    WHERE pl.locale = ${locale} AND pl.status = 'published' AND pl.published_at <= now() AND pl.search_tsv @@ ${tsq}
    ORDER BY rank DESC, pl.published_at DESC
    LIMIT ${limit}`);
  let items = rows.rows as { id: string; slug: string; title: string; summary: string; publishedAt: string }[];
  if (items.length < 3 && locale === "tr") {
    const trg = await db.execute(sql`
      SELECT pl.id, pl.slug, pl.title, pl.summary, pl.published_at AS "publishedAt", word_similarity(tr_fold(${query}), pl.title_fold) AS s
      FROM post_locales pl
      WHERE pl.locale = 'tr' AND pl.status = 'published' AND pl.published_at <= now() AND tr_fold(${query}) <% pl.title_fold
      ORDER BY s DESC LIMIT 10`);
    const seen = new Set(items.map((i) => i.id));
    items = items.concat((trg.rows as typeof items).filter((r) => !seen.has(r.id)));
  }
  return items;
}
