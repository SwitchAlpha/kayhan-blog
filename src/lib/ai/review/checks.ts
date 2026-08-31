import type { JSONContent } from "@tiptap/core";
import { nodeText } from "@/lib/content/derive";

export type Check = { id: string; level: "error" | "warn" | "ok"; message: string };

const VOWELS = /[aeıioöuüAEIİOÖUÜ]/g;
/** Ateşman readability (Turkish Flesch adaptation). Higher = easier. */
export function atesman(text: string): number | null {
  const sentences = text.split(/[.!?…]+\s/).filter((s) => s.trim().length > 0).length || 1;
  const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (words.length < 30) return null;
  const syllables = words.reduce((n, w) => n + Math.max(1, (w.match(VOWELS) ?? []).length), 0);
  return Math.round(198.825 - 40.175 * (syllables / words.length) - 2.61 * (words.length / sentences));
}

export function deterministicChecks(input: { locale: "tr" | "en"; title: string; seoTitle: string | null; summary: string; seoDescription: string | null; doc: JSONContent; plain: string; wordCount: number; internalLinks: number; duplicateTitle: boolean; duplicateDescription: boolean }): Check[] {
  const out: Check[] = [];
  const title = input.seoTitle ?? input.title;
  const desc = input.seoDescription ?? input.summary;
  out.push(title.length > 65 ? { id: "title-length", level: "warn", message: `Başlık ${title.length} karakter (~60 önerilir)` } : { id: "title-length", level: "ok", message: "Başlık uzunluğu uygun" });
  if (!desc) out.push({ id: "description", level: "error", message: "Meta açıklama (özet) boş" });
  else out.push(desc.length < 70 || desc.length > 165 ? { id: "description", level: "warn", message: `Açıklama ${desc.length} karakter (70–160 önerilir)` } : { id: "description", level: "ok", message: "Açıklama uzunluğu uygun" });
  if (input.duplicateTitle) out.push({ id: "dup-title", level: "error", message: "Aynı başlık başka bir yazıda kullanılmış" });
  if (input.duplicateDescription) out.push({ id: "dup-desc", level: "warn", message: "Aynı açıklama başka bir yazıda kullanılmış" });
  const nodes = input.doc.content ?? [];
  let lastLevel = 1;
  let headings = 0;
  for (const n of nodes) {
    if (n.type === "heading") {
      const lvl = Number(n.attrs?.level ?? 2);
      headings++;
      if (lvl > lastLevel + 1) out.push({ id: "heading-order", level: "warn", message: `Başlık sırası atlıyor: H${lastLevel} → H${lvl} ("${nodeText(n).slice(0, 40)}")` });
      lastLevel = lvl;
    }
    if (n.type === "image" && !(n.attrs?.alt as string | undefined)?.trim()) out.push({ id: "img-alt", level: "error", message: "Alt metni olmayan görsel var" });
  }
  if (input.wordCount >= 600 && headings === 0) out.push({ id: "no-headings", level: "warn", message: "600+ kelimelik yazıda hiç alt başlık yok" });
  out.push(input.wordCount < 300 ? { id: "length", level: "warn", message: `${input.wordCount} kelime — ince içerik riski (AdSense/Google)` } : { id: "length", level: "ok", message: `${input.wordCount} kelime` });
  if (input.internalLinks === 0) out.push({ id: "internal-links", level: "warn", message: "Hiç iç bağlantı yok (otomatik linkleme yayında çalışır)" });
  if (input.locale === "tr") {
    const a = atesman(input.plain);
    if (a !== null) out.push({ id: "readability", level: a < 40 ? "warn" : "ok", message: `Ateşman okunabilirlik: ${a} (${a >= 70 ? "kolay" : a >= 50 ? "orta" : "zor"})` });
  }
  return out;
}
