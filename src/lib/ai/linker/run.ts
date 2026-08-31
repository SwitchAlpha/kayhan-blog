import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { db } from "@/lib/db/client";
import { appliedLinks, linkRuns, linkSuggestions, postLocales } from "@/lib/db/schema";
import { deriveContent } from "@/lib/content/derive";
import { href } from "@/lib/seo/routes";
import { aiEnabled, MODELS } from "../client";
import { LINKER_PROMPT_VERSION } from "../prompts/linker";
import { findCandidates, findReverseSources } from "./candidates";
import { proposeLinks } from "./propose";
import { applyGuards, foldAnchor, type Candidate, type GuardContext } from "./guards";
import { applyLinkToDoc, countInternalLinks, removeLinkFromDoc } from "./apply";
import { tagsFor } from "@/lib/posts/publish";
import { enqueueIndexNow } from "@/lib/indexnow/queue";
import { SITE_URL } from "@/lib/site/config";

export type LinkRunResult = { applied: number; rejected: number; skipped?: string; touched: string[] };

async function anchorHistogram(): Promise<Map<string, number>> {
  const rows = await db.select({ t: appliedLinks.targetLocaleId, a: appliedLinks.anchorFold, n: sql<number>`count(*)` }).from(appliedLinks).where(isNull(appliedLinks.revertedAt)).groupBy(appliedLinks.targetLocaleId, appliedLinks.anchorFold);
  return new Map(rows.map((r) => [`${r.t}|${r.a}`, Number(r.n)]));
}

/**
 * Forward linking for source S against a candidate set. Fully automatic: accepted proposals are applied to the
 * canonical JSON, derived columns re-rendered, audit rows written. Idempotent via link_runs.input_hash.
 */
export async function linkSource(sourceLocaleId: string, opts: { candidates?: Candidate[]; maxLinks?: number; trigger: string; direction?: "forward" | "reverse" }): Promise<LinkRunResult> {
  if (!(await aiEnabled())) return { applied: 0, rejected: 0, skipped: "ai disabled", touched: [] };
  const src = await db.query.postLocales.findFirst({ where: eq(postLocales.id, sourceLocaleId) });
  if (!src || src.status !== "published") return { applied: 0, rejected: 0, skipped: "source not published", touched: [] };
  const candidates = opts.candidates ?? (await findCandidates(sourceLocaleId));
  if (candidates.length === 0) return { applied: 0, rejected: 0, skipped: "no candidates", touched: [] };

  const inputHash = createHash("sha256").update([src.contentHash, ...candidates.map((c) => c.localeId).sort(), LINKER_PROMPT_VERSION, MODELS.linker].join("|")).digest("hex");
  const prior = await db.query.linkRuns.findFirst({ where: and(eq(linkRuns.sourceLocaleId, sourceLocaleId), eq(linkRuns.inputHash, inputHash), eq(linkRuns.status, "done")) });
  if (prior) return { applied: 0, rejected: 0, skipped: "identical run already done", touched: [] };

  const [run] = await db.insert(linkRuns).values({ sourceLocaleId, direction: opts.direction ?? "forward", trigger: opts.trigger, model: MODELS.linker, promptVersion: LINKER_PROMPT_VERSION, effort: "low", inputHash, candidates: candidates as unknown as object, status: "running" }).returning({ id: linkRuns.id });
  try {
    const derived = await deriveContent(src.contentJson as JSONContent, src.locale);
    const doc = derived.contentJson;
    const existingOutbound = countInternalLinks(doc, SITE_URL);
    const hist = await anchorHistogram();
    const anchorsUsed: Record<string, string[]> = {};
    for (const c of candidates) anchorsUsed[c.slug] = [...hist.keys()].filter((k) => k.startsWith(c.localeId + "|")).map((k) => k.split("|")[1]);
    const ctx: GuardContext = { doc, paragraphs: derived.paragraphs, candidates, wordCount: derived.wordCount, existingOutbound, anchorHistogram: hist, maxLinks: opts.maxLinks };
    const maxLinks = Math.min(opts.maxLinks ?? 8, Math.max(0, Math.min(8, Math.max(3, Math.floor(derived.wordCount / 175))) - existingOutbound));
    const { proposals, usage } = await proposeLinks({ locale: src.locale, sourceTitle: src.title, paragraphs: derived.paragraphs, candidates, anchorsUsed, maxLinks, postLocaleId: sourceLocaleId });
    const { accepted, rejected } = applyGuards(proposals, ctx);

    for (const r of rejected) {
      const target = candidates.find((c) => c.slug === r.target_slug);
      if (target) await db.insert(linkSuggestions).values({ runId: run.id, sourceLocaleId, targetLocaleId: target.localeId, paragraphIndex: r.paragraph_index, anchorText: r.anchor_text, confidence: r.confidence, rationale: r.rationale, similarity: target.similarity, status: "rejected_guard", guardReason: r.reason });
    }
    let next = doc;
    let applied = 0;
    for (const a of accepted) {
      const aiLinkId = randomUUID();
      const updated = applyLinkToDoc(next, a.paragraph_index, a.anchor_text, href(src.locale, "post", { slug: a.target.slug }), aiLinkId);
      if (!updated) continue;
      next = updated;
      const [sug] = await db.insert(linkSuggestions).values({ runId: run.id, sourceLocaleId, targetLocaleId: a.target.localeId, paragraphIndex: a.paragraph_index, anchorText: a.anchor_text, confidence: a.confidence, rationale: a.rationale, similarity: a.target.similarity, status: "applied" }).returning({ id: linkSuggestions.id });
      await db.insert(appliedLinks).values({ suggestionId: sug.id, sourceLocaleId, targetLocaleId: a.target.localeId, aiLinkId, anchorText: a.anchor_text, anchorFold: foldAnchor(a.anchor_text), paragraphIndex: a.paragraph_index, createdBy: "ai" });
      applied++;
    }
    if (applied > 0) await persistDoc(sourceLocaleId, src.locale, next);
    await db.update(linkRuns).set({ status: "done", usage, finishedAt: new Date() }).where(eq(linkRuns.id, run.id));
    return { applied, rejected: rejected.length, touched: applied > 0 ? [sourceLocaleId] : [] };
  } catch (e) {
    await db.update(linkRuns).set({ status: "error", error: e instanceof Error ? e.message : String(e), finishedAt: new Date() }).where(eq(linkRuns.id, run.id));
    throw e;
  }
}

/** Older posts link TO the new post (one link each). */
export async function reverseLink(targetLocaleId: string, trigger: string): Promise<LinkRunResult> {
  if (!(await aiEnabled())) return { applied: 0, rejected: 0, skipped: "ai disabled", touched: [] };
  const target = await db.query.postLocales.findFirst({ where: eq(postLocales.id, targetLocaleId) });
  if (!target || target.status !== "published") return { applied: 0, rejected: 0, touched: [] };
  const sources = await findReverseSources(targetLocaleId);
  const asCandidate: Candidate = { localeId: target.id, slug: target.slug, title: target.title, summary: target.summary, similarity: 1 };
  const touched: string[] = [];
  let applied = 0, rejected = 0;
  for (const s of sources) {
    const r = await linkSource(s.localeId, { candidates: [{ ...asCandidate, similarity: s.similarity }], maxLinks: 1, trigger, direction: "reverse" });
    applied += r.applied; rejected += r.rejected; touched.push(...r.touched);
  }
  return { applied, rejected, touched };
}

/** Re-derive HTML/MD/plain from the new JSON and bump links_version (content_hash unchanged semantics: links don't count as content edits). */
async function persistDoc(localeId: string, locale: "tr" | "en", doc: JSONContent) {
  const d = await deriveContent(doc, locale);
  await db.update(postLocales).set({ contentJson: d.contentJson, contentHtml: d.html, contentMd: d.md, contentPlain: d.plain, toc: d.toc, linksVersion: sql`${postLocales.linksVersion} + 1`, updatedAt: new Date() }).where(eq(postLocales.id, localeId));
}

/** Revert one AI link (or all for a post). Human links are never touched. */
export async function revertLinks(sourceLocaleId: string, aiLinkId: string | null, by: string, reason = "manual") {
  const src = await db.query.postLocales.findFirst({ where: eq(postLocales.id, sourceLocaleId) });
  if (!src) return 0;
  const rows = await db.select().from(appliedLinks).where(and(eq(appliedLinks.sourceLocaleId, sourceLocaleId), isNull(appliedLinks.revertedAt), eq(appliedLinks.createdBy, "ai"), ...(aiLinkId ? [eq(appliedLinks.aiLinkId, aiLinkId)] : [])));
  if (rows.length === 0) return 0;
  let doc = src.contentJson as JSONContent;
  for (const r of rows) doc = removeLinkFromDoc(doc, r.aiLinkId);
  await persistDoc(sourceLocaleId, src.locale, doc);
  await db.update(appliedLinks).set({ revertedAt: new Date(), revertedBy: by, revertReason: reason }).where(sql`${appliedLinks.id} = ANY(${rows.map((r) => r.id)}::uuid[])`);
  await db.update(linkSuggestions).set({ status: "reverted" }).where(sql`${linkSuggestions.id} = ANY(${rows.map((r) => r.suggestionId).filter(Boolean)}::uuid[])`);
  return rows.length;
}

/** Tags/paths to refresh after a linking run touched posts. */
export async function afterLinking(touched: string[], revalidate: (t: string[]) => Promise<void> | void) {
  if (touched.length === 0) return;
  const rows = await db.select({ id: postLocales.id, postId: postLocales.postId, locale: postLocales.locale, slug: postLocales.slug }).from(postLocales).where(sql`${postLocales.id} = ANY(${touched}::uuid[])`);
  await revalidate(rows.flatMap(tagsFor));
  await enqueueIndexNow(rows.map((r) => href(r.locale, "post", { slug: r.slug })), "update", 600);
}
