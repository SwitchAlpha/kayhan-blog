import { describe, expect, it } from "vitest";
import { clampSeo } from "@/lib/ai/seo/clamp";

describe("clampSeo", () => {
  const base = { seo_title: "Başlık", seo_description: "Açıklama", summary: "Özet", tags: ["a"] };

  it("trims whitespace the model leaves around fields", () => {
    const out = clampSeo({ ...base, seo_title: "  Başlık  ", tags: [" react ", "  "] });
    expect(out.seo_title).toBe("Başlık");
    expect(out.tags).toEqual(["react"]);
  });

  it("caps each field at the column limit so a long answer cannot fail the save", () => {
    const out = clampSeo({
      seo_title: "x".repeat(500),
      seo_description: "y".repeat(500),
      summary: "z".repeat(900),
      tags: Array.from({ length: 20 }, (_, i) => `t${i}`),
    });
    expect(out.seo_title).toHaveLength(120);
    expect(out.seo_description).toHaveLength(300);
    expect(out.summary).toHaveLength(500);
    expect(out.tags).toHaveLength(6);
  });

  it("drops blank tags rather than passing empty names through", () => {
    expect(clampSeo({ ...base, tags: ["", "  ", "kod"] }).tags).toEqual(["kod"]);
  });
});

