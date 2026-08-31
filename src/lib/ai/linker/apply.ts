import type { JSONContent } from "@tiptap/core";

/**
 * Wrap `anchor` (first occurrence inside a single text node of top-level paragraph `paragraphIndex`)
 * with a link mark. Pure AST transformation; returns a new doc or null if not applicable.
 */
export function applyLinkToDoc(doc: JSONContent, paragraphIndex: number, anchor: string, href: string, aiLinkId: string): JSONContent | null {
  const node = doc.content?.[paragraphIndex];
  if (!node || node.type !== "paragraph") return null;
  const content = node.content ?? [];
  const idx = content.findIndex((t) => t.type === "text" && (t.text ?? "").includes(anchor) && !t.marks?.some((m) => m.type === "link"));
  if (idx === -1) return null;
  const t = content[idx];
  const text = t.text ?? "";
  const at = text.indexOf(anchor);
  const before = text.slice(0, at);
  const after = text.slice(at + anchor.length);
  const linkMark = { type: "link", attrs: { href, target: null, rel: null, class: null, aiLinkId } };
  const pieces: JSONContent[] = [];
  if (before) pieces.push({ ...t, text: before });
  pieces.push({ type: "text", text: anchor, marks: [...(t.marks ?? []), linkMark] });
  if (after) pieces.push({ ...t, text: after });
  const newContent = [...content.slice(0, idx), ...pieces, ...content.slice(idx + 1)];
  const newNode = { ...node, content: newContent };
  return { ...doc, content: doc.content!.map((n, i) => (i === paragraphIndex ? newNode : n)) };
}

/** Remove the link mark carrying `aiLinkId` everywhere; merges nothing (renderers cope with adjacent text nodes). */
export function removeLinkFromDoc(doc: JSONContent, aiLinkId: string): JSONContent {
  const walk = (n: JSONContent): JSONContent => {
    const marks = n.marks?.filter((m) => !(m.type === "link" && m.attrs?.aiLinkId === aiLinkId));
    const out: JSONContent = { ...n };
    if (n.marks) out.marks = marks && marks.length ? marks : undefined;
    if (n.content) out.content = n.content.map(walk);
    return out;
  };
  return walk(doc);
}

export function countAiLinks(doc: JSONContent): number {
  let n = 0;
  const walk = (x: JSONContent) => { if (x.marks?.some((m) => m.type === "link" && m.attrs?.aiLinkId)) n++; x.content?.forEach(walk); };
  walk(doc);
  return n;
}
export function countInternalLinks(doc: JSONContent, siteUrl: string): number {
  let n = 0;
  const walk = (x: JSONContent) => { if (x.marks?.some((m) => m.type === "link" && typeof m.attrs?.href === "string" && (m.attrs.href.startsWith("/") || m.attrs.href.startsWith(siteUrl)))) n++; x.content?.forEach(walk); };
  walk(doc);
  return n;
}
