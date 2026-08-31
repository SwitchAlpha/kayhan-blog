import type { Locale } from "@/lib/db/schema";

// Everything an installation needs in order to call itself something other than
// the blog this code was originally written for. All of it is read at runtime
// (no NEXT_PUBLIC_ prefix), so renaming a site is an env change and a restart —
// no rebuild.

const env = (key: string) => {
  const v = process.env[key]?.trim();
  return v ? v : undefined;
};

/** Public origin. Also the fallback used to tell internal links from outbound ones. */
export const SITE_URL = env("SITE_URL") ?? "http://localhost:3000";

/** Full name: browser titles, OG `siteName`, feed titles, PWA manifest, auth. */
export const SITE_NAME = env("SITE_NAME") ?? "My Blog";

/** Short form for the PWA manifest and other tight spaces. */
export const SITE_SHORT_NAME = env("SITE_SHORT_NAME") ?? SITE_NAME;

/** Person credited as the author: bylines, JSON-LD, the footer copyright line. */
export const SITE_AUTHOR = env("SITE_AUTHOR") ?? SITE_NAME;

/** The wordmark drawn in the header and admin sidebar. See {@link splitWordmark}. */
export const SITE_WORDMARK = env("SITE_WORDMARK") ?? SITE_NAME;

/** Shown on the contact page seeded by `pnpm seed:pages`. Empty hides it. */
export const SITE_CONTACT_EMAIL = env("SITE_CONTACT_EMAIL") ?? "";

const TAGLINE: Record<Locale, string | undefined> = {
  tr: env("SITE_TAGLINE_TR"),
  en: env("SITE_TAGLINE_EN"),
};

const DESCRIPTION: Record<Locale, string | undefined> = {
  tr: env("SITE_DESCRIPTION_TR"),
  en: env("SITE_DESCRIPTION_EN"),
};

/** Home page heading. Falls back to the site name rather than inventing a phrase. */
export const tagline = (locale: Locale) => TAGLINE[locale] ?? SITE_NAME;

/** One-line summary: home page lede, feed description, llms.txt header. */
export const description = (locale: Locale) =>
  DESCRIPTION[locale] ??
  (locale === "en"
    ? "Notes on software, work, and whatever I'm still figuring out."
    : "Yazılım, iş ve hâlâ çözmeye çalıştığım her şey üzerine notlar.");

/**
 * Splits a wordmark on its last dot so the dot can be accented, which is what
 * makes a domain-shaped name read as one: `my.blog` → `my` · `blog`.
 * A name with no interior dot comes back whole and is rendered as plain text.
 */
export function splitWordmark(wordmark: string = SITE_WORDMARK): [string, string | null] {
  const i = wordmark.lastIndexOf(".");
  return i > 0 && i < wordmark.length - 1
    ? [wordmark.slice(0, i), wordmark.slice(i + 1)]
    : [wordmark, null];
}
