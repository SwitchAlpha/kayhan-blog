import { createHash } from "node:crypto";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { renderToMarkdown } from "@tiptap/static-renderer/pm/markdown";
import type { JSONContent } from "@tiptap/core";
import { contentExtensions } from "./extensions";
import { sanitizeContentHtml } from "./sanitize";
import { highlight } from "./shiki";
import { toSlug } from "./slug";

export type TocEntry = { id: string; level: number; text: string };
export type Paragraph = { index: number; text: string; hash: string };

export type Derived = {
  html: string;
  md: string;
  plain: string;
  /** top-level paragraph nodes only (link-eligible), numbered by position among ALL top-level nodes */
  paragraphs: Paragraph[];
  toc: TocEntry[];
  wordCount: number;
  readingTimeSec: number;
  contentHash: string;
  contentJson: JSONContent;
};

const WPM: Record<string, number> = { tr: 170, en: 200 };

export function nodeText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(nodeText).join("");
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w)).length;
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Normalize all text nodes to NFC in place (the DB normalizer assumes NFC). */
function normalizeNFC(node: JSONContent): JSONContent {
  if (node.type === "text" && node.text) return { ...node, text: node.text.normalize("NFC") };
  if (node.content) return { ...node, content: node.content.map(normalizeNFC) };
  return node;
}

/** Assign stable ids to headings (slug of text, de-duplicated) so TOC links work. */
function withHeadingIds(doc: JSONContent): { doc: JSONContent; toc: TocEntry[] } {
  const seen = new Map<string, number>();
  const toc: TocEntry[] = [];
  const content = (doc.content ?? []).map((n) => {
    if (n.type !== "heading") return n;
    const text = nodeText(n).trim();
    const base = toSlug(text) || "baslik";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    toc.push({ id, level: Number(n.attrs?.level ?? 2), text });
    return { ...n, attrs: { ...(n.attrs ?? {}), id } };
  });
  return { doc: { ...doc, content }, toc };
}

export async function deriveContent(input: JSONContent, locale: "tr" | "en"): Promise<Derived> {
  const normalized = normalizeNFC(input);
  const { doc, toc } = withHeadingIds(normalized);

  // Pre-highlight code blocks (shiki is async; the renderer is sync).
  const highlighted = new Map<string, string>();
  for (const n of doc.content ?? []) {
    if (n.type === "codeBlock") {
      const code = nodeText(n);
      const lang = (n.attrs?.language as string | null) ?? null;
      highlighted.set(sha256(`${lang}\n${code}`), await highlight(code, lang));
    }
  }

  // Headings: the PM schema drops our synthetic `id` attr, so assign ids by order of appearance.
  let headingIdx = 0;
  // Code blocks: emit placeholders, sanitize, then substitute trusted shiki output (escaped by shiki).
  const codeSlots: string[] = [];
  const rawHtml = renderToHTMLString({
    content: doc,
    extensions: contentExtensions,
    options: {
      nodeMapping: {
        heading: ({ node, children }) => {
          const level = Number(node.attrs?.level ?? 2);
          const id = toc[headingIdx++]?.id ?? "";
          return `<h${level} id="${id}">${children}</h${level}>`;
        },
        codeBlock: ({ node }) => {
          // the pm renderer passes ProseMirror Node instances here
          const code = (node as unknown as { textContent: string }).textContent;
          const lang = (node.attrs?.language as string | null) ?? null;
          const html = highlighted.get(sha256(`${lang}\n${code}`)) ?? `<pre><code></code></pre>`;
          const safeLang = (lang ?? "text").replace(/[^a-z0-9+#.-]/gi, "");
          codeSlots.push(`<div class="code-block" data-language="${safeLang}">${html}</div>`);
          return `<p data-code-slot="${codeSlots.length - 1}"></p>`;
        },
      },
    },
  });
  const html = sanitizeContentHtml(rawHtml).replace(/<p data-code-slot="(\d+)"><\/p>/g, (_m, i) => codeSlots[Number(i)] ?? "");
  const md = renderToMarkdown({ content: doc, extensions: contentExtensions });

  const paragraphs: Paragraph[] = [];
  const plainParts: string[] = [];
  (doc.content ?? []).forEach((n, index) => {
    const text = nodeText(n).replace(/\s+/g, " ").trim();
    if (!text) return;
    plainParts.push(text);
    if (n.type === "paragraph") paragraphs.push({ index, text, hash: sha256(text) });
  });
  const plain = plainParts.join("\n\n");
  const wordCount = countWords(plain);
  const readingTimeSec = Math.max(30, Math.round((wordCount / (WPM[locale] ?? 200)) * 60));
  const contentHash = sha256(JSON.stringify(doc));

  return { html, md, plain, paragraphs, toc, wordCount, readingTimeSec, contentHash, contentJson: doc };
}
