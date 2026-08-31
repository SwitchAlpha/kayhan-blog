import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/client";
import { categories, postLocales, posts, type Locale } from "@/lib/db/schema";
import { tags } from "@/lib/cache/tags";
import { absolute, href } from "./routes";
import { SITE_AUTHOR, SITE_NAME, description, tagline } from "@/lib/site/config";

const HEAD = (l: Locale) => `${tagline(l)} — ${description(l)}`;

async function publishedRows(locale?: Locale) {
  return db
    .select({ id: postLocales.id, locale: postLocales.locale, slug: postLocales.slug, title: postLocales.title, summary: postLocales.summary, md: postLocales.contentMd, publishedAt: postLocales.publishedAt, updatedAt: postLocales.contentUpdatedAt, tagNames: postLocales.tagNames, catTr: categories.nameTr, catEn: categories.nameEn })
    .from(postLocales)
    .innerJoin(posts, eq(posts.id, postLocales.postId))
    .innerJoin(categories, eq(categories.id, posts.categoryId))
    .where(and(eq(postLocales.status, "published"), sql`${postLocales.publishedAt} <= now()`, ...(locale ? [eq(postLocales.locale, locale)] : [])))
    .orderBy(desc(postLocales.publishedAt));
}

export const llmsPath = (locale: Locale, slug: string) => `/llms/${locale}/${slug}.txt`;

/** One post as plain Markdown with a small metadata header. */
export function postToLlmsText(r: Awaited<ReturnType<typeof publishedRows>>[number]): string {
  const url = absolute(href(r.locale, "post", { slug: r.slug }));
  const date = r.publishedAt ? new Date(r.publishedAt).toISOString().slice(0, 10) : "";
  const updated = r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : "";
  const meta = [`# ${r.title}`, "", `> ${r.summary}`, "", `- URL: ${url}`, `- ${r.locale === "en" ? "Language" : "Dil"}: ${r.locale}`, `- ${r.locale === "en" ? "Published" : "Yayın"}: ${date}${updated && updated !== date ? ` (${r.locale === "en" ? "updated" : "güncelleme"}: ${updated})` : ""}`, `- ${r.locale === "en" ? "Category" : "Kategori"}: ${r.locale === "en" ? r.catEn : r.catTr}`, ...(r.tagNames ? [`- ${r.locale === "en" ? "Tags" : "Etiketler"}: ${r.tagNames.split(" ").join(", ")}`] : []), `- ${r.locale === "en" ? "Author" : "Yazar"}: ${SITE_AUTHOR} (${absolute(href(r.locale, "about"))})`, "", "---", ""];
  return meta.join("\n") + r.md.trim() + "\n";
}

export const getPostLlms = async (locale: Locale, slug: string) =>
  unstable_cache(
    async () => {
      const rows = await publishedRows(locale);
      const r = rows.find((x) => x.slug === slug);
      return r ? postToLlmsText(r) : null;
    },
    ["llms-post", locale, slug],
    { tags: [tags.posts(locale), `post-slug:${locale}:${slug}`] },
  )();

/** /llms.txt — site index per the llms.txt convention: H1, blockquote summary, sections of links. */
export const buildLlmsIndex = () =>
  unstable_cache(
    async () => {
      const rows = await publishedRows();
      const section = (locale: Locale, title: string) => {
        const list = rows.filter((r) => r.locale === locale);
        if (list.length === 0) return "";
        return [`## ${title}`, "", ...list.map((r) => `- [${r.title}](${absolute(llmsPath(r.locale, r.slug))}): ${r.summary || ""}`.trimEnd()), ""].join("\n");
      };
      return [
        `# ${SITE_NAME}`,
        "",
        `> ${HEAD("tr")}`,
        `> ${HEAD("en")}`,
        "",
        `Site: ${absolute("/")} · English: ${absolute("/en")} · Full text of all posts: ${absolute("/llms-full.txt")}`,
        `Her yazının Markdown sürümü: ${absolute("/llms/tr/")}<slug>.txt (EN: ${absolute("/llms/en/")}<slug>.txt).`,
        "",
        section("tr", "Yazılar (Türkçe)"),
        section("en", "Posts (English)"),
        "## Optional",
        "",
        `- [Hakkımda](${absolute(href("tr", "about"))})`,
        `- [Bu blog nasıl yazılıyor](${absolute(href("tr", "disclosure"))})`,
        `- [RSS](${absolute("/feed.xml")})`,
        "",
      ].join("\n");
    },
    ["llms-index"],
    { tags: [tags.posts("tr"), tags.posts("en"), tags.sitemap] },
  )();

export const buildLlmsFull = () =>
  unstable_cache(
    async () => {
      const rows = await publishedRows();
      return rows.map(postToLlmsText).join("\n\n---\n\n");
    },
    ["llms-full"],
    { tags: [tags.posts("tr"), tags.posts("en"), tags.sitemap] },
  )();
