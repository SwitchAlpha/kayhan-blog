import slugify from "slugify";

/** Turkish-aware map applied BEFORE lowercasing (never call toLowerCase on raw Turkish: İ → i̇). */
const TR_MAP: Record<string, string> = { İ: "i", I: "i", ı: "i", Ş: "s", ş: "s", Ğ: "g", ğ: "g", Ü: "u", ü: "u", Ö: "o", ö: "o", Ç: "c", ç: "c" };

export const RESERVED_SLUGS = new Set([
  "en", "tr", "admin", "api", "kategori", "category", "etiket", "tag", "arama", "search", "sayfa", "page",
  "hakkimda", "about", "iletisim", "contact", "gizlilik-politikasi", "privacy-policy", "cerez-politikasi", "cookie-policy",
  "bu-blog-nasil-yaziliyor", "how-this-blog-is-written", "feed.xml", "sitemap.xml", "robots.txt", "ads.txt", "uploads", "og", "k", "t", "s", "p", "pg",
]);

export function toSlug(input: string): string {
  const mapped = input.normalize("NFC").replace(/[İIıŞşĞğÜüÖöÇç]/g, (ch) => TR_MAP[ch] ?? ch);
  const s = slugify(mapped, { lower: true, strict: true, trim: true });
  return s.replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
}

export function isValidSlug(s: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && !RESERVED_SLUGS.has(s);
}
