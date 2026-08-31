import Link from "next/link";
import type { Locale } from "@/lib/db/schema";
import { href } from "@/lib/seo/routes";
import { SITE_AUTHOR, SITE_NAME } from "@/lib/site/config";
import { Wordmark } from "@/components/site/Wordmark";

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = locale === "en" ? { posts: "Posts", about: "About", search: "Search", switch: "TR", switchTitle: "Türkçe" } : { posts: "Yazılar", about: "Hakkımda", search: "Ara", switch: "EN", switchTitle: "English" };
  return (
    <header className="mx-auto flex w-full max-w-[720px] items-baseline justify-between px-5 pt-8 pb-10 md:px-0">
      <Link href={href(locale, "home")} className="font-display text-[1.35rem] font-semibold tracking-tight text-ink" aria-label={SITE_NAME}>
        <Wordmark />
      </Link>
      <nav className="flex items-baseline gap-5 font-display text-[0.92rem] text-ink-2" aria-label={locale === "en" ? "Main" : "Ana menü"}>
        <Link className="hover:text-ink" href={href(locale, "home")}>{t.posts}</Link>
        <Link className="hover:text-ink" href={href(locale, "about")}>{t.about}</Link>
        <Link className="hover:text-ink" href={href(locale, "search")}>{t.search}</Link>
        <Link className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-3 hover:text-ink" href={locale === "en" ? "/" : "/en"} hrefLang={locale === "en" ? "tr" : "en"} title={t.switchTitle}>{t.switch}</Link>
      </nav>
    </header>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = locale === "en"
    ? { privacy: "Privacy", cookies: "Cookie policy", contact: "Contact", disclosure: "How this blog is written", prefs: "Cookie preferences", rss: "RSS" }
    : { privacy: "Gizlilik", cookies: "Çerez politikası", contact: "İletişim", disclosure: "Bu blog nasıl yazılıyor", prefs: "Çerez tercihleri", rss: "RSS" };
  return (
    <footer className="mx-auto mt-24 w-full max-w-[720px] border-t border-rule px-5 py-8 font-display text-[0.8rem] text-ink-3 md:px-0">
      <nav className="flex flex-wrap gap-x-5 gap-y-2">
        <Link className="hover:text-ink" href={href(locale, "privacy")}>{t.privacy}</Link>
        <Link className="hover:text-ink" href={href(locale, "cookies")}>{t.cookies}</Link>
        <Link className="hover:text-ink" href={href(locale, "contact")}>{t.contact}</Link>
        <Link className="hover:text-ink" href={href(locale, "disclosure")}>{t.disclosure}</Link>
        <a className="hover:text-ink" href={locale === "en" ? "/en/feed.xml" : "/feed.xml"}>{t.rss}</a>
        <button type="button" data-consent-open className="hover:text-ink">{t.prefs}</button>
      </nav>
      <p className="mt-5 font-mono text-[0.7rem] uppercase tracking-wider">© {new Date().getFullYear()} {SITE_AUTHOR}</p>
    </footer>
  );
}
