import type { JSONContent } from "@tiptap/core";

export type Proposal = { target_slug: string; paragraph_index: number; anchor_text: string; confidence: number; rationale: string };
export type Candidate = { localeId: string; slug: string; title: string; summary: string; similarity: number };
export type GuardContext = {
  doc: JSONContent;
  paragraphs: { index: number; text: string }[];
  candidates: Candidate[];
  wordCount: number;
  existingOutbound: number;
  /** folded anchor → count of active site-wide uses per target localeId */
  anchorHistogram: Map<string, number>;
  maxLinks?: number;
};
export type Accepted = Proposal & { target: Candidate; paragraphText: string };
export type Rejected = Proposal & { reason: string };

const STOP = new Set(["ve", "veya", "ile", "bir", "bu", "şu", "o", "de", "da", "ki", "için", "gibi", "the", "a", "an", "and", "or", "of", "to", "in", "on", "for"]);
export const foldAnchor = (s: string) => s.normalize("NFC").toLocaleLowerCase("tr").replace(/[ıi̇]/g, "i").replace(/[şğüöç]/g, (c) => ({ ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" })[c] ?? c).replace(/\s+/g, " ").trim();

export function capFor(wordCount: number, existingOutbound: number, max = 8): number {
  return Math.max(0, Math.min(max, Math.max(3, Math.floor(wordCount / 175))) - existingOutbound);
}

/** Is this top-level node a plain paragraph with no existing link mark, and does the anchor sit inside ONE text node? */
export function paragraphEligible(node: JSONContent | undefined, anchor: string): { ok: true; nodeIndex: number } | { ok: false; reason: string } {
  if (!node || node.type !== "paragraph") return { ok: false, reason: "not a paragraph" };
  const texts = node.content ?? [];
  if (texts.some((t) => t.marks?.some((m) => m.type === "link"))) return { ok: false, reason: "paragraph already has a link" };
  const idx = texts.findIndex((t) => t.type === "text" && (t.text ?? "").includes(anchor));
  if (idx === -1) return { ok: false, reason: "anchor not inside a single text node" };
  return { ok: true, nodeIndex: idx };
}

/** Apply the hard guards to model proposals. Pure; unit-tested. */
export function applyGuards(proposals: Proposal[], ctx: GuardContext): { accepted: Accepted[]; rejected: Rejected[] } {
  const accepted: Accepted[] = [];
  const rejected: Rejected[] = [];
  const cap = capFor(ctx.wordCount, ctx.existingOutbound, ctx.maxLinks ?? 8);
  const usedTargets = new Set<string>();
  const usedParagraphs = new Set<number>();
  const bySlug = new Map(ctx.candidates.map((c) => [c.slug, c]));
  const byIndex = new Map(ctx.paragraphs.map((p) => [p.index, p.text]));

  for (const p of [...proposals].sort((a, b) => b.confidence - a.confidence)) {
    const reject = (reason: string) => rejected.push({ ...p, reason });
    if (accepted.length >= cap) { reject("cap reached"); continue; }
    const target = bySlug.get(p.target_slug);
    if (!target) { reject("target not in candidate set"); continue; }
    if (usedTargets.has(target.localeId)) { reject("target already linked in this post"); continue; }
    if (usedParagraphs.has(p.paragraph_index)) { reject("paragraph already used"); continue; }
    const text = byIndex.get(p.paragraph_index);
    if (text === undefined) { reject("paragraph index not link-eligible"); continue; }
    const anchor = p.anchor_text.normalize("NFC").trim();
    const words = anchor.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 6 || anchor.length > 60) { reject("anchor length"); continue; }
    if (words.every((w) => STOP.has(w.toLocaleLowerCase("tr")))) { reject("anchor is stopwords only"); continue; }
    if (/^[\p{P}\s]|[\p{P}\s]$/u.test(anchor)) { reject("anchor starts/ends with punctuation"); continue; }
    if (!text.includes(anchor)) { reject("anchor not verbatim in paragraph"); continue; }
    if (p.confidence < 0.6) { reject("low confidence"); continue; }
    const elig = paragraphEligible(ctx.doc.content?.[p.paragraph_index], anchor);
    if (!elig.ok) { reject(elig.reason); continue; }
    const hist = ctx.anchorHistogram.get(`${target.localeId}|${foldAnchor(anchor)}`) ?? 0;
    if (hist >= 2) { reject("anchor already used ≥2× site-wide for this target"); continue; }
    usedTargets.add(target.localeId);
    usedParagraphs.add(p.paragraph_index);
    accepted.push({ ...p, anchor_text: anchor, target, paragraphText: text });
  }
  return { accepted, rejected };
}
