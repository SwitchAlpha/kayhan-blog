import type { JSONContent } from "@tiptap/core";

/** Markdown (AI output subset) → Tiptap JSON. Server-safe, dependency-free. */
export function markdownToDoc(md: string): JSONContent {
  // Minimal, dependable Markdown subset parser used for AI output (headings, paragraphs, lists, quotes, code fences, images, bold/italic).
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const content: JSONContent[] = [];
  let i = 0;
  const inline = (text: string): JSONContent[] => {
    const out: JSONContent[] = [];
    const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
      if (m[2]) out.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
      else if (m[4]) out.push({ type: "text", text: m[4], marks: [{ type: "italic" }] });
      else if (m[6]) out.push({ type: "text", text: m[6], marks: [{ type: "code" }] });
      else if (m[8]) out.push({ type: "text", text: m[8], marks: [{ type: "link", attrs: { href: m[9] } }] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ type: "text", text: text.slice(last) });
    return out.length ? out : [{ type: "text", text }];
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { content.push({ type: "heading", attrs: { level: Math.min(4, Math.max(2, h[1].length)) }, content: inline(h[2].trim()) }); i++; continue; }
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim() || null; const buf: string[] = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; content.push({ type: "codeBlock", attrs: { language: lang }, content: [{ type: "text", text: buf.join("\n") }] }); continue;
    }
    const img = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/.exec(line);
    if (img) { content.push({ type: "image", attrs: { src: img[2], alt: img[1] } }); i++; continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { content.push({ type: "horizontalRule" }); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf: string[] = []; while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      content.push({ type: "blockquote", content: [{ type: "paragraph", content: inline(buf.join(" ")) }] }); continue;
    }
    const ul = /^[-*+]\s+/.test(line); const ol = /^\d+[.)]\s+/.test(line);
    if (ul || ol) {
      const items: JSONContent[] = []; const re = ul ? /^[-*+]\s+/ : /^\d+[.)]\s+/;
      while (i < lines.length && re.test(lines[i])) { items.push({ type: "listItem", content: [{ type: "paragraph", content: inline(lines[i].replace(re, "")) }] }); i++; }
      content.push({ type: ul ? "bulletList" : "orderedList", content: items }); continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s|!\[)/.test(lines[i])) { buf.push(lines[i].trim()); i++; }
    content.push({ type: "paragraph", content: inline(buf.join(" ")) });
  }
  return { type: "doc", content };
}
