import { describe, expect, it } from "vitest";
import { consentDecided, consentGranted, parseConsent, serializeConsent } from "@/lib/consent/config";

describe("consent cookie", () => {
  it("round-trips a grant", () => {
    const v = serializeConsent(true);
    expect(parseConsent(v)?.ads).toBe(true);
    expect(consentGranted(v)).toBe(true);
    expect(consentDecided(v)).toBe(true);
  });
  it("treats reject as decided but not granted", () => {
    const v = serializeConsent(false);
    expect(consentGranted(v)).toBe(false);
    expect(consentDecided(v)).toBe(true);
  });
  it("ignores garbage, other policy versions and expired consents", () => {
    expect(consentGranted("hello")).toBe(false);
    expect(consentGranted("v99.1.1700000000")).toBe(false);
    expect(consentGranted(`v1.1.${Math.floor(Date.now() / 1000) - 400 * 86400}`)).toBe(false);
  });
});
