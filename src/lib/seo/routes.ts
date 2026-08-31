import type { Locale } from "@/lib/db/schema";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:3000";

const SEG = {
  tr: { category: "kategori", tag: "etiket", search: "arama", page: "sayfa", about: "hakkimda", contact: "iletisim", privacy: "gizlilik-politikasi", cookies: "cerez-politikasi", disclosure: "bu-blog-nasil-yaziliyor" },
  en: { category: "category", tag: "tag", search: "search", page: "page", about: "about", contact: "contact", privacy: "privacy-policy", cookies: "cookie-policy", disclosure: "how-this-blog-is-written" },
} as const;

type Kind = "home" | "post" | "category" | "tag" | "search" | "about" | "contact" | "privacy" | "cookies" | "disclosure";

/** Single source of truth for public URLs (relative). */
export function href(locale: Locale, kind: Kind, params: { slug?: string; page?: number } = {}): string {
  const prefix = locale === "en" ? "/en" : "";
  const s = SEG[locale] ?? SEG.tr;
  const pg = params.page && params.page > 1 ? `/${s.page}/${params.page}` : "";
  switch (kind) {
    case "home": return `${prefix}${pg}` || "/";
    case "post": return `${prefix}/${params.slug}`;
    case "category": return `${prefix}/${s.category}/${params.slug}${pg}`;
    case "tag": return `${prefix}/${s.tag}/${params.slug}${pg}`;
    case "search": return `${prefix}/${s.search}`;
    default: return `${prefix}/${s[kind]}`;
  }
}

export function absolute(path: string): string {
  return new URL(path, SITE_URL).toString();
}
