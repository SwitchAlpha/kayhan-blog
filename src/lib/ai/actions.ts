"use server";
import type { JSONContent } from "@tiptap/core";
import { desc, eq, isNull, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appliedLinks, linkSuggestions, postLocales, seoReviews } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { reviewPost } from "./review";
import { translateToEnglish } from "./translate";
import { enhanceText, enhancedDoc } from "./enhance";
import { afterLinking, linkSource, revertLinks } from "./linker/run";
import { embedPostLocale } from "./embeddings";
import { revalidateTags } from "@/lib/cache/revalidate";
import { aiEnabled } from "./client";

export async function runSeoReview(localeId: string) {
  const user = await requireAdmin();
  return reviewPost(localeId, user.email);
}

export async function createEnglishDraft(trLocaleId: string) {
  await requireAdmin();
  if (!(await aiEnabled())) throw new Error("AI kapalı (OPENAI_API_KEY yok veya duraklatıldı)");
  return translateToEnglish(trLocaleId);
}

export async function runLinkerNow(localeId: string) {
  await requireAdmin();
  if (!(await aiEnabled())) throw new Error("AI kapalı");
  await embedPostLocale(localeId);
  const r = await linkSource(localeId, { trigger: "manual" });
  await afterLinking(r.touched, (t) => revalidateTags(t));
  return r;
}

export async function revertAiLink(localeId: string, aiLinkId: string | null) {
  const user = await requireAdmin();
  const n = await revertLinks(localeId, aiLinkId, user.email);
  const row = await db.query.postLocales.findFirst({ where: eq(postLocales.id, localeId) });
  if (row) await afterLinking([localeId], (t) => revalidateTags(t));
  return { reverted: n };
}

export async function getPostAiPanel(localeId: string) {
  await requireAdmin();
  const [review, links, rejected] = await Promise.all([
    db.query.seoReviews.findFirst({ where: eq(seoReviews.postLocaleId, localeId), orderBy: desc(seoReviews.createdAt) }),
    db.select({ id: appliedLinks.id, aiLinkId: appliedLinks.aiLinkId, anchor: appliedLinks.anchorText, paragraph: appliedLinks.paragraphIndex, createdBy: appliedLinks.createdBy, appliedAt: appliedLinks.appliedAt, targetTitle: postLocales.title, targetSlug: postLocales.slug })
      .from(appliedLinks).innerJoin(postLocales, eq(postLocales.id, appliedLinks.targetLocaleId)).where(and(eq(appliedLinks.sourceLocaleId, localeId), isNull(appliedLinks.revertedAt))),
    db.select({ anchor: linkSuggestions.anchorText, reason: linkSuggestions.guardReason, targetTitle: postLocales.title }).from(linkSuggestions).innerJoin(postLocales, eq(postLocales.id, linkSuggestions.targetLocaleId)).where(and(eq(linkSuggestions.sourceLocaleId, localeId), eq(linkSuggestions.status, "rejected_guard"))).orderBy(desc(linkSuggestions.createdAt)).limit(10),
  ]);
  return { review: review ?? null, links, rejected };
}

/**
 * Proposes an edited version of the document currently in the editor.
 * Writes nothing — the caller decides whether to apply it, and the author's
 * save is what makes it permanent.
 */
export async function enhancePostText(locale: "tr" | "en", doc: JSONContent) {
  await requireAdmin();
  if (!(await aiEnabled())) throw new Error("AI kapalı (OPENAI_API_KEY yok veya duraklatıldı)");
  const out = await enhanceText({ locale, doc });
  if (!out) throw new Error("Metin iyileştirilemedi (çok kısa ya da model boş döndü)");
  return { doc: enhancedDoc(out.markdown), notes: out.notes };
}
