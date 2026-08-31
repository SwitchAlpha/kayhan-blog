import "server-only";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { zodTextFormat } from "openai/helpers/zod";
import { db } from "@/lib/db/client";
import { postLocales } from "@/lib/db/schema";
import { MODELS, openai, recordCall, reserveBudget, handleProviderError } from "../client";
import { deriveContent } from "@/lib/content/derive";
import { markdownToDoc } from "@/lib/content/markdown";
import { isValidSlug, toSlug } from "@/lib/content/slug";

const Out = z.object({ title: z.string(), summary: z.string(), seo_title: z.string(), seo_description: z.string(), body_markdown: z.string() });

const SYSTEM = `You translate Turkish blog posts into natural, idiomatic English for an international audience. Preserve structure exactly: headings (##/###), lists, blockquotes, code blocks (do not translate code), images (keep the same image URLs, translate alt text). Remove internal site links (keep the anchor text as plain text). Do not add or drop paragraphs. Return the body as Markdown.`;

/** TR → EN draft. Creates/overwrites the EN locale row as an ai_draft (never publishes). */
export async function translateToEnglish(trLocaleId: string) {
  const src = await db.query.postLocales.findFirst({ where: eq(postLocales.id, trLocaleId) });
  if (!src || src.locale !== "tr") throw new Error("kaynak TR yazı bulunamadı");
  await reserveBudget();
  const t0 = Date.now();
  let out: z.infer<typeof Out> | null = null;
  try {
    const res = await openai().responses.parse({
      model: MODELS.translate,
      reasoning: { effort: "medium" },
      input: [{ role: "system", content: SYSTEM }, { role: "user", content: `TITLE: ${src.title}\nSUMMARY: ${src.summary}\nSEO TITLE: ${src.seoTitle ?? ""}\nSEO DESCRIPTION: ${src.seoDescription ?? ""}\n\nBODY (markdown):\n${src.contentMd}` }],
      text: { format: zodTextFormat(Out, "translation") },
    });
    out = res.output_parsed;
    await recordCall({ task: "translate", model: MODELS.translate, effort: "medium", postLocaleId: trLocaleId, contentHash: src.contentHash, inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0, durationMs: Date.now() - t0, status: "ok" });
  } catch (e) {
    await recordCall({ task: "translate", model: MODELS.translate, effort: "medium", postLocaleId: trLocaleId, inputTokens: 0, outputTokens: 0, durationMs: Date.now() - t0, status: "error", error: e instanceof Error ? e.message : String(e) });
    await handleProviderError(e);
  }
  if (!out) throw new Error("çeviri boş döndü");
  const doc = markdownToDoc(out.body_markdown);
  const d = await deriveContent(doc, "en");
  let slug = toSlug(out.title);
  if (!isValidSlug(slug)) slug = `post-${src.slug}`;
  // ensure unique EN slug
  const clash = await db.query.postLocales.findFirst({ where: and(eq(postLocales.locale, "en"), eq(postLocales.slug, slug)) });
  if (clash && clash.postId !== src.postId) slug = `${slug}-${src.postId.slice(0, 6)}`;
  const existing = await db.query.postLocales.findFirst({ where: and(eq(postLocales.postId, src.postId), eq(postLocales.locale, "en")) });
  const values = { title: out.title, summary: out.summary, seoTitle: out.seo_title || null, seoDescription: out.seo_description || null, contentJson: d.contentJson, contentHtml: d.html, contentMd: d.md, contentPlain: d.plain, toc: d.toc, wordCount: d.wordCount, readingTimeSec: d.readingTimeSec, contentHash: d.contentHash, translationStatus: "ai_draft" as const, translatedFromHash: src.contentHash, updatedAt: new Date() };
  if (existing && existing.status === "published") throw new Error("EN yazı zaten yayında; önce yayından kaldırın");
  if (existing) await db.update(postLocales).set({ ...values, slug: existing.slug }).where(eq(postLocales.id, existing.id));
  else await db.insert(postLocales).values({ ...values, postId: src.postId, locale: "en", slug, status: "draft" });
  const row = await db.query.postLocales.findFirst({ where: and(eq(postLocales.postId, src.postId), eq(postLocales.locale, "en")) });
  return { id: row!.id, slug: row!.slug };
}
