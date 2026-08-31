export const CONSENT_COOKIE = "kb_consent";
export const CONSENT_ID_COOKIE = "kb_cid";
export const CONSENT_TTL_DAYS = Number(process.env.CONSENT_TTL_DAYS ?? 180);
export const CONSENT_POLICY_VERSION = process.env.CONSENT_POLICY_VERSION ?? "1";

export type ConsentState = { version: string; ads: boolean; ts: number };

/** cookie value: v<policy>.<1|0>.<unix ts> */
export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  const m = /^v([^.]+)\.([01])\.(\d+)$/.exec(raw);
  if (!m) return null;
  return { version: m[1], ads: m[2] === "1", ts: Number(m[3]) };
}
export function serializeConsent(ads: boolean): string {
  return `v${CONSENT_POLICY_VERSION}.${ads ? "1" : "0"}.${Math.floor(Date.now() / 1000)}`;
}
/** Consent is valid only for the current policy version and within the TTL. */
export function consentGranted(raw: string | undefined | null): boolean {
  const c = parseConsent(raw);
  if (!c || c.version !== CONSENT_POLICY_VERSION) return false;
  return c.ads && Date.now() / 1000 - c.ts < CONSENT_TTL_DAYS * 86400;
}
export function consentDecided(raw: string | undefined | null): boolean {
  const c = parseConsent(raw);
  return Boolean(c && c.version === CONSENT_POLICY_VERSION && Date.now() / 1000 - c.ts < CONSENT_TTL_DAYS * 86400);
}
