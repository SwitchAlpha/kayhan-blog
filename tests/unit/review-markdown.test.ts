import { describe, expect, it } from "vitest";
import { markdownToDoc } from "@/lib/content/markdown";
import { atesman, deterministicChecks } from "@/lib/ai/review/checks";

describe("markdownToDoc", () => {
  it("parses headings, paragraphs, lists, code fences, images and inline marks", () => {
    const doc = markdownToDoc("## Başlık\n\nMerhaba **dünya** ve *sen*.\n\n- bir\n- iki\n\n```ts\nconst a = 1;\n```\n\n![alt metin](/uploads/x.webp)\n");
    const types = doc.content!.map((n) => n.type);
    expect(types).toEqual(["heading", "paragraph", "bulletList", "codeBlock", "image"]);
    expect(doc.content![1].content![1]).toMatchObject({ text: "dünya", marks: [{ type: "bold" }] });
    expect(doc.content![3].attrs?.language).toBe("ts");
    expect(doc.content![4].attrs).toMatchObject({ alt: "alt metin", src: "/uploads/x.webp" });
  });
});

describe("deterministic SEO checks", () => {
  it("flags long titles, missing alt, heading jumps and thin content", () => {
    const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "x" }] }, { type: "image", attrs: { src: "/a.webp", alt: "" } }] };
    const checks = deterministicChecks({ locale: "tr", title: "a".repeat(80), seoTitle: null, summary: "", seoDescription: null, doc, plain: "kısa", wordCount: 50, internalLinks: 0, duplicateTitle: true, duplicateDescription: false });
    const ids = checks.filter((c) => c.level !== "ok").map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["title-length", "description", "dup-title", "heading-order", "img-alt", "length", "internal-links"]));
  });
  it("computes Ateşman readability for Turkish text", () => {
    const text = Array.from({ length: 12 }, () => "Bugün hava çok güzel ve biz parka gittik.").join(" ");
    const a = atesman(text)!;
    expect(a).toBeGreaterThan(50);
  });
});
