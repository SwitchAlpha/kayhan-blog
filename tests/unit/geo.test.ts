import { describe, expect, it } from "vitest";
import { geoBucket } from "@/lib/geo/bucket";

describe("geoBucket", () => {
  it("treats missing header as row (crawlers must get the loader)", () => {
    expect(geoBucket(null)).toBe("row");
    expect(geoBucket(undefined)).toBe("row");
  });
  it("routes Turkey and unknown countries to the KVKK regime", () => {
    for (const c of ["TR", "tr", "XX", "T1", ""]) expect(geoBucket(c)).toBe("tr");
  });
  it("routes EEA/UK/CH to Google's CMP", () => {
    for (const c of ["DE", "FR", "GB", "CH", "NO", "IS"]) expect(geoBucket(c)).toBe("eea");
  });
  it("everything else is row", () => {
    for (const c of ["US", "BR", "JP", "AZ"]) expect(geoBucket(c)).toBe("row");
  });
});
