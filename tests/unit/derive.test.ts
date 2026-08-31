import { describe, expect, it } from "vitest";
import { deriveContent } from "@/lib/content/derive";

const doc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "İlk Başlık" }] },
    { type: "paragraph", content: [{ type: "text", text: "Merhaba " }, { type: "text", text: "dünya", marks: [{ type: "bold" }] }, { type: "text", text: "." }] },
    { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const a = 1;" }] },
    { type: "paragraph", content: [{ type: "text", text: "Bkz. " }, { type: "text", text: "example", marks: [{ type: "link", attrs: { href: "https://example.com/x" } }] }] },
    { type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script> zararsız" }] },
  ],
};

describe("deriveContent", () => {
  it("renders sanitized HTML with heading ids and highlighted code", async () => {
    const d = await deriveContent(doc, "tr");
    expect(d.html).toContain('<h2 id="ilk-baslik">İlk Başlık</h2>');
    expect(d.html).toContain("<strong>dünya</strong>");
    expect(d.html).toContain('data-language="ts"');
    expect(d.html).toContain("shiki");
    expect(d.html).not.toContain("<script>");
    expect(d.html).toContain("&lt;script&gt;");
  });
  it("produces markdown, plain text, paragraphs, toc, counts and a stable hash", async () => {
    const d = await deriveContent(doc, "tr");
    expect(d.md).toContain("## İlk Başlık");
    expect(d.md).toContain("**dünya**");
    expect(d.plain.startsWith("İlk Başlık\n\nMerhaba dünya.")).toBe(true);
    expect(d.paragraphs.map((p) => p.index)).toEqual([1, 3, 4]);
    expect(d.toc).toEqual([{ id: "ilk-baslik", level: 2, text: "İlk Başlık" }]);
    expect(d.wordCount).toBeGreaterThan(5);
    expect(d.readingTimeSec).toBeGreaterThanOrEqual(30);
    const again = await deriveContent(doc, "tr");
    expect(again.contentHash).toBe(d.contentHash);
  });
});
