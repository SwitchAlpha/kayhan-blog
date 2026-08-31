import { describe, expect, it } from "vitest";
import { splitHtmlForAds } from "@/lib/content/ad-positions";

const para = (n: number) => `<p>${Array.from({ length: n }, (_, i) => `kelime${i}`).join(" ")}</p>`;

describe("splitHtmlForAds", () => {
  it("does not split short posts", () => {
    expect(splitHtmlForAds(para(100) + para(100), 200)).toHaveLength(1);
  });
  it("inserts the first unit after ~250 words at a paragraph boundary and never inside a block", () => {
    const html = "<h2 id=\"a\">Başlık</h2>" + para(120) + para(120) + para(60) + "<ul><li>x</li></ul>" + para(80) + para(80) + para(80);
    const parts = splitHtmlForAds(html, 540);
    expect(parts.length).toBe(2);
    expect(parts.join("")).toBe(html);
    expect(parts[0].endsWith("</p>")).toBe(true);
  });
  it("adds a mid-article unit for long posts", () => {
    const html = Array.from({ length: 12 }, () => para(100)).join("");
    const parts = splitHtmlForAds(html, 1200);
    expect(parts.length).toBe(3);
    expect(parts.join("")).toBe(html);
  });
});
