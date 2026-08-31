import "server-only";
import { unstable_cache } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, postLocales, posts, type Locale } from "@/lib/db/schema";
import { tags } from "@/lib/cache/tags";
import { absolute, href, SITE_URL } from "./routes";
import { SITE_NAME, description } from "@/lib/site/config";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const buildRss = (locale: Locale) =>
  unstable_cache(
    async () => {
      const rows = await db
        .select({ slug: postLocales.slug, title: postLocales.title, summary: postLocales.summary, html: postLocales.contentHtml, publishedAt: postLocales.publishedAt, updatedAt: postLocales.contentUpdatedAt, cat: locale === "en" ? categories.nameEn : categories.nameTr })
        .from(postLocales)
        .innerJoin(posts, eq(posts.id, postLocales.postId))
        .innerJoin(categories, eq(categories.id, posts.categoryId))
        .where(and(eq(postLocales.locale, locale), eq(postLocales.status, "published"), sql`${postLocales.publishedAt} <= now()`))
        .orderBy(desc(postLocales.publishedAt))
        .limit(30);
      const self = absolute(locale === "en" ? "/en/feed.xml" : "/feed.xml");
      const home = absolute(href(locale, "home"));
      const items = rows
        .map((r) => {
          const url = absolute(href(locale, "post", { slug: r.slug }));
          const html = r.html.replace(/(src|href)="\//g, `$1="${SITE_URL}/`);
          return `<item><title>${esc(r.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(r.publishedAt!).toUTCString()}</pubDate><category>${esc(r.cat)}</category><description>${esc(r.summary)}</description><content:encoded><![CDATA[${html}]]></content:encoded></item>`;
        })
        .join("");
      const last = rows[0]?.publishedAt ? new Date(rows[0].publishedAt).toUTCString() : new Date().toUTCString();
      return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>${esc(SITE_NAME)}</title><link>${home}</link><description>${esc(description(locale))}</description><language>${locale}</language><lastBuildDate>${last}</lastBuildDate><atom:link href="${self}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
    },
    ["rss", locale],
    { tags: [tags.feed(locale), tags.posts(locale)] },
  )();
