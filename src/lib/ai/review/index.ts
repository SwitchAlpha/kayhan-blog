import "server-only";
import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { zodTextFormat } from "openai/helpers/zod";
import type { JSONContent } from "@tiptap/core";
import { db } from "@/lib/db/client";
import { postLocales, seoReviews } from "@/lib/db/schema";
import { MODELS, openai, recordCall, reserveBudget, handleProviderError, aiEnabled, cachedResult, putCache } from "../client";
import { countInternalLinks } from "../linker/apply";
import { deterministicChecks, type Check } from "./checks";
import { SITE_URL } from "@/lib/site/config";

export const REVIEW_PROMPT_VERSION = "review-v1";

const ReviewSchema = z.object({
  title: z.object({ issues: z.array(z.string()), suggestions: z.array(z.string()) }),
  description: z.object({ suggestions: z.array(z.string()) }),
  outline: z.object({ issues: z.array(z.string()), suggested: z.array(z.string()) }),
  coverage: z.object({ search_intent: z.string(), missing_subtopics: z.array(z.string()) }),
  eeat_notes: z.array(z.string()),
  risk_flags: z.array(z.string()),
  clickbait_risk: z.string(),
});
export type LlmReview = z.infer<typeof ReviewSchema>;

const SYSTEM = (locale: string) => `You are a senior SEO editor reviewing a personal blog post written in ${locale === "tr" ? "Turkish" : "English"} for Google Search (2026). Give concrete, specific, actionable feedback in ${locale === "tr" ? "Turkish" : "English"}. Do not suggest FAQ schema or keyword stuffing. Titles should be honest (no clickbait), the H1 equals the title, sections should answer the reader's sub-questions. Suggest 3 alternative titles (≤60 chars) and 2 meta descriptions (120–160 chars). Note E-E-A-T opportunities (first-hand experience, disclosure). risk_flags: thin content, duplicated/AI-sounding text, misleading claims.`;

export async function reviewPost(localeId: string, actor = "admin"): Promise<{ deterministic: Check[]; llm: LlmReview | null; cached: boolean }> {
  const row = await db.query.postLocales.findFirst({ where: eq(postLocales.id, localeId) });
  if (!row) throw new Error("post not found");
  const [dupT] = await db.select({ n: sql<number>`count(*)` }).from(postLocales).where(and(eq(postLocales.locale, row.locale), ne(postLocales.id, localeId), eq(postLocales.title, row.title)));
  const [dupD] = await db.select({ n: sql<number>`count(*)` }).from(postLocales).where(and(eq(postLocales.locale, row.locale), ne(postLocales.id, localeId), eq(postLocales.summary, row.summary), ne(postLocales.summary, "")));
  const doc = row.contentJson as JSONContent;
  const deterministic = deterministicChecks({ locale: row.locale, title: row.title, seoTitle: row.seoTitle, summary: row.summary, seoDescription: row.seoDescription, doc, plain: row.contentPlain, wordCount: row.wordCount, internalLinks: countInternalLinks(doc, SITE_URL), duplicateTitle: Number(dupT.n) > 0, duplicateDescription: Number(dupD.n) > 0 });

  let llm: LlmReview | null = null;
  let cached = false;
  if (await aiEnabled()) {
    const key = `${row.contentHash}:${row.title}:${row.summary}`;
    const hit = await cachedResult<LlmReview>("review", key, MODELS.review, REVIEW_PROMPT_VERSION);
    if (hit) { llm = hit; cached = true; }
    else {
      await reserveBudget();
      const t0 = Date.now();
      try {
        const res = await openai().responses.parse({
          model: MODELS.review,
          reasoning: { effort: "medium" },
          input: [{ role: "system", content: SYSTEM(row.locale) }, { role: "user", content: `TITLE: ${row.title}\nSEO TITLE: ${row.seoTitle ?? "-"}\nMETA DESCRIPTION: ${row.seoDescription ?? row.summary}\nWORD COUNT: ${row.wordCount}\n\nCONTENT (markdown):\n${row.contentMd.slice(0, 40_000)}` }],
          text: { format: zodTextFormat(ReviewSchema, "seo_review") },
        });
        llm = res.output_parsed;
        await recordCall({ task: "review", model: MODELS.review, effort: "medium", postLocaleId: localeId, contentHash: row.contentHash, inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0, durationMs: Date.now() - t0, status: "ok" });
        if (llm) await putCache("review", key, MODELS.review, REVIEW_PROMPT_VERSION, llm);
      } catch (e) {
        await recordCall({ task: "review", model: MODELS.review, effort: "medium", postLocaleId: localeId, inputTokens: 0, outputTokens: 0, durationMs: Date.now() - t0, status: "error", error: e instanceof Error ? e.message : String(e) });
        await handleProviderError(e);
      }
    }
  }
  const score = Math.max(0, 100 - deterministic.filter((c) => c.level === "error").length * 20 - deterministic.filter((c) => c.level === "warn").length * 8);
  await db.insert(seoReviews).values({ postLocaleId: localeId, contentHash: row.contentHash, deterministic: deterministic as unknown as object, llm: (llm ?? null) as unknown as object, score, model: llm ? MODELS.review : null, promptVersion: REVIEW_PROMPT_VERSION });
  void actor;
  return { deterministic, llm, cached };
}
