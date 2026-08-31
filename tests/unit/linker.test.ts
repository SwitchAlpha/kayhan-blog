import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { applyGuards, capFor, type Candidate, type GuardContext } from "@/lib/ai/linker/guards";
import { applyLinkToDoc, countAiLinks, removeLinkFromDoc } from "@/lib/ai/linker/apply";

const p = (text: string, marks?: object[]) => ({ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] });
const doc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Gözlük seçimi" }] },
    p("Doğru gözlük seçimi için yüz şeklinize uygun çerçeve bulmalısınız."),
    p("Zaten linkli paragraf.", [{ type: "link", attrs: { href: "/x" } }]),
    p("Güneş gözlüğü alırken UV koruması en önemli kriterdir."),
    { type: "codeBlock", content: [{ type: "text", text: "kod" }] },
  ],
} as JSONContent;
const cands: Candidate[] = [
  { localeId: "L1", slug: "yuz-sekli", title: "Yüz şekli", summary: "", similarity: 0.8 },
  { localeId: "L2", slug: "uv-korumasi", title: "UV", summary: "", similarity: 0.7 },
];
const ctx: GuardContext = {
  doc, paragraphs: [{ index: 1, text: doc.content![1].content![0].text! }, { index: 3, text: doc.content![3].content![0].text! }],
  candidates: cands, wordCount: 900, existingOutbound: 0, anchorHistogram: new Map(),
};

describe("linker guards", () => {
  it("accepts verbatim anchors in plain paragraphs and rejects the rest with reasons", () => {
    const { accepted, rejected } = applyGuards([
      { target_slug: "yuz-sekli", paragraph_index: 1, anchor_text: "yüz şeklinize uygun çerçeve", confidence: 0.9, rationale: "" },
      { target_slug: "uv-korumasi", paragraph_index: 3, anchor_text: "UV koruması", confidence: 0.8, rationale: "" },
      { target_slug: "uv-korumasi", paragraph_index: 3, anchor_text: "en önemli kriterdir", confidence: 0.95, rationale: "" }, // duplicate target
      { target_slug: "yuz-sekli", paragraph_index: 2, anchor_text: "Zaten linkli", confidence: 0.9, rationale: "" },  // paragraph has link
      { target_slug: "yuz-sekli", paragraph_index: 0, anchor_text: "Gözlük seçimi", confidence: 0.9, rationale: "" }, // heading
      { target_slug: "nope", paragraph_index: 1, anchor_text: "Doğru gözlük", confidence: 0.9, rationale: "" },
      { target_slug: "uv-korumasi", paragraph_index: 3, anchor_text: "yok böyle", confidence: 0.9, rationale: "" },
    ], ctx);
    expect(accepted.map((a) => a.target_slug).sort()).toEqual(["uv-korumasi", "yuz-sekli"]);
    expect(accepted.find((a) => a.target_slug === "uv-korumasi")!.anchor_text).toBe("en önemli kriterdir"); // highest confidence wins
    expect(rejected.map((r) => r.reason)).toEqual(expect.arrayContaining(["target already linked in this post", "target not in candidate set"]));
    const nv = applyGuards([{ target_slug: "uv-korumasi", paragraph_index: 3, anchor_text: "yok böyle", confidence: 0.9, rationale: "" }], ctx);
    expect(nv.rejected[0].reason).toBe("anchor not verbatim in paragraph");
    // headings / code blocks / linked paragraphs are never eligible
    for (const idx of [0, 2, 4]) {
      const r = applyGuards([{ target_slug: "yuz-sekli", paragraph_index: idx, anchor_text: "Gözlük seçimi", confidence: 0.9, rationale: "" }], ctx);
      expect(r.accepted).toHaveLength(0);
      expect(r.rejected[0].reason).toBe("paragraph index not link-eligible");
    }
  });
  it("enforces anchor diversity and caps", () => {
    const hist = new Map([["L1|yuz seklinize uygun cerceve", 2]]);
    const { rejected } = applyGuards([{ target_slug: "yuz-sekli", paragraph_index: 1, anchor_text: "yüz şeklinize uygun çerçeve", confidence: 0.9, rationale: "" }], { ...ctx, anchorHistogram: hist });
    expect(rejected[0].reason).toMatch(/site-wide/);
    expect(capFor(300, 0)).toBe(3);
    expect(capFor(2000, 2)).toBe(6);
    expect(capFor(2000, 9)).toBe(0);
  });
});

describe("apply/remove link marks", () => {
  it("wraps the anchor in a link mark inside a single text node and reverts cleanly", () => {
    const linked = applyLinkToDoc(doc, 1, "yüz şeklinize uygun çerçeve", "/yuz-sekli", "id-1")!;
    const para = linked.content![1].content!;
    expect(para).toHaveLength(3);
    expect(para[1].text).toBe("yüz şeklinize uygun çerçeve");
    expect(para[1].marks![0]).toMatchObject({ type: "link", attrs: { href: "/yuz-sekli", aiLinkId: "id-1" } });
    expect(countAiLinks(linked)).toBe(1);
    const reverted = removeLinkFromDoc(linked, "id-1");
    expect(countAiLinks(reverted)).toBe(0);
    expect(reverted.content![1].content!.map((t) => t.text).join("")).toBe(doc.content![1].content![0].text);
  });
  it("refuses to link inside paragraphs that already contain a link", () => {
    expect(applyLinkToDoc(doc, 2, "Zaten linkli", "/x", "id")).toBeNull();
  });
});
