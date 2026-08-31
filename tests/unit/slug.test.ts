import { describe, expect, it } from "vitest";
import { isValidSlug, toSlug } from "@/lib/content/slug";

describe("toSlug", () => {
  it("transliterates Turkish letters before lowercasing", () => {
    expect(toSlug("İstanbul'da Işık ve Gölge")).toBe("istanbulda-isik-ve-golge");
    expect(toSlug("ÇĞÖŞÜ çğöşü")).toBe("cgosu-cgosu");
  });
  it("never produces the combining dot (U+0307)", () => {
    expect(toSlug("İİİ")).not.toMatch(/̇/);
    expect(toSlug("İİİ")).toBe("iii");
  });
  it("collapses punctuation and whitespace to single hyphens", () => {
    expect(toSlug("  Merhaba,   dünya!!  ")).toBe("merhaba-dunya");
  });
  it("validates slug shape and reserved words", () => {
    expect(isValidSlug("merhaba-dunya")).toBe(true);
    expect(isValidSlug("-a")).toBe(false);
    expect(isValidSlug("admin")).toBe(false);
    expect(isValidSlug("en")).toBe(false);
  });
});
