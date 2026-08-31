import type { MetadataRoute } from "next";
import { and, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/client";
import { categories, pages, postLocales, posts, type Locale } from "@/lib/db/schema";
import { tags } from "@/lib/cache/tags";
import { PAGE_KEYS, type PageKey } from "@/lib/db/queries/site";
import { absolute, href } from "@/lib/seo/routes";

export const dynamic = "force-dynamic";

const build = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const rows = await db
      .select({ postId: postLocales.postId, locale: postLocales.locale, slug: postLocales.slug, publishedAt: postLocales.publishedAt, updatedAt: postLocales.contentUpdatedAt })
      .from(postLocales)
      .innerJoin(posts, eq(posts.id, postLocales.postId))
      .where(and(eq(postLocales.status, "published"), sql`${postLocales.publishedAt} <= now()`));
    const byPost = new Map<string, typeof rows>();
    for (const r of rows) byPost.set(r.postId, [...(byPost.get(r.postId) ?? []), r]);

    const out: MetadataRoute.Sitemap = [];
    for (const l of ["tr", "en"] as Locale[]) {
      out.push({ url: absolute(href(l, "home")), alternates: { languages: { tr: absolute(href("tr", "home")), en: absolute(href("en", "home")) } } });
    }
    for (const group of byPost.values()) {
      const pair = group.length === 2 ? Object.fromEntries(group.map((g) => [g.locale, absolute(href(g.locale, "post", { slug: g.slug }))])) : undefined;
      for (const r of group) {
        out.push({ url: absolute(href(r.locale, "post", { slug: r.slug })), lastModified: new Date(r.updatedAt ?? r.publishedAt!), ...(pair ? { alternates: { languages: pair } } : {}) });
      }
    }
    const cats = await db.select().from(categories);
    for (const c of cats) {
      const langs = { tr: absolute(href("tr", "category", { slug: c.slugTr })), en: absolute(href("en", "category", { slug: c.slugEn })) };
      out.push({ url: langs.tr, alternates: { languages: langs } }, { url: langs.en, alternates: { languages: langs } });
    }
    const pg = await db.select({ key: pages.key, locale: pages.locale, updatedAt: pages.updatedAt }).from(pages);
    for (const p of pg) {
      if (!(PAGE_KEYS as readonly string[]).includes(p.key)) continue;
      const k = p.key as PageKey;
      out.push({ url: absolute(href(p.locale, k)), lastModified: new Date(p.updatedAt), alternates: { languages: { tr: absolute(href("tr", k)), en: absolute(href("en", k)) } } });
    }
    return out;
  },
  ["sitemap"],
  { tags: [tags.sitemap, tags.posts("tr"), tags.posts("en")] },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await build();
  return entries.map((e) => ({ ...e, lastModified: e.lastModified ? new Date(e.lastModified as string | Date) : undefined }));
}
