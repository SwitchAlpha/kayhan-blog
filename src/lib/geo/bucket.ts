export type GeoBucket = "eea" | "tr" | "row";

/** EU-27 + EEA (IS, LI, NO) + UK + Switzerland: Google's certified-CMP scope. */
export const EEA_UK_CH = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
  "IS","LI","NO","GB","CH",
]);

/**
 * Derive the consent regime from Cloudflare's `cf-ipcountry`.
 * - no header at all (direct/dev/bot without geo) → "row" (loader present; needed for AdSense verification crawlers)
 * - TR, or unknown/Tor (XX, T1) → "tr" (KVKK: nothing from Google before opt-in)
 * - EEA/UK/CH → "eea" (Google's own TCF CMP)
 */
export function geoBucket(country: string | null | undefined): GeoBucket {
  if (country === null || country === undefined) return "row";
  const cc = country.trim().toUpperCase();
  if (cc === "" || cc === "TR" || cc === "XX" || cc === "T1") return "tr";
  if (EEA_UK_CH.has(cc)) return "eea";
  return "row";
}
