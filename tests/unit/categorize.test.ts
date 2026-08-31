import { describe, expect, it } from "vitest";
import { isNearDuplicate } from "@/lib/ai/categorize/dedupe";

// The guard that keeps a category list from turning into thirty synonyms.
describe("isNearDuplicate", () => {
  const existing = ["yazilim", "is", "ogrendiklerim"];

  it("matches an exact name regardless of casing and accents", () => {
    expect(isNearDuplicate("Yazılım", existing)).toBe("yazilim");
  });

  it("catches a proposal that merely extends an existing category", () => {
    expect(isNearDuplicate("Yazılım Geliştirme", existing)).toBe("yazilim");
  });

  it("catches a proposal an existing category extends", () => {
    expect(isNearDuplicate("Öğrendiklerim ve Notlar", existing)).toBe("ogrendiklerim");
  });

  it("lets a genuinely new subject through", () => {
    expect(isNearDuplicate("Kitaplar", existing)).toBeNull();
  });

  it("returns null for a name that slugifies to nothing", () => {
    expect(isNearDuplicate("!!!", existing)).toBeNull();
  });
});
