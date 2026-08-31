import Link from "next/link";
import type { Locale } from "@/lib/db/schema";
import type { PostCard } from "@/lib/db/queries/posts";
import { href } from "@/lib/seo/routes";

const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Journal stamp: big day number, small month + year — sits in the notebook margin on wide screens. */
export function DateStamp({ date, locale, className = "" }: { date: Date | null; locale: Locale; className?: string }) {
  if (!date) return null;
  const m = (locale === "en" ? MONTHS_EN : MONTHS_TR)[date.getMonth()];
  return (
    <time dateTime={date.toISOString()} className={`stamp ${className}`}>
      <b>{date.getDate()}</b>
      {m} {date.getFullYear()}
    </time>
  );
}

export function PostList({ items, locale }: { items: PostCard[]; locale: Locale }) {
  const min = locale === "en" ? "min" : "dk";
  return (
    <ol className="notebook space-y-12">
      {items.map((p) => (
        <li key={p.id} className="relative">
          <DateStamp date={p.publishedAt} locale={locale} className="mb-2 block md:mb-0" />
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-3">
            <Link href={href(locale, "category", { slug: locale === "en" ? p.category.slugEn : p.category.slugTr })} className="hover:text-pen">{locale === "en" ? p.category.nameEn : p.category.nameTr}</Link>
            <span aria-hidden> · </span>{Math.max(1, Math.round(p.readingTimeSec / 60))} {min}
          </p>
          <h2 className="mt-1 font-display text-[1.5rem] font-semibold leading-[1.2] tracking-tight">
            <Link href={href(locale, "post", { slug: p.slug })} className="title-link">{p.title}</Link>
          </h2>
          {p.summary && <p className="mt-2 max-w-[60ch] text-[1rem] leading-relaxed text-ink-2">{p.summary}</p>}
        </li>
      ))}
    </ol>
  );
}

export function Pagination({ locale, kind, slug, page, hasMore }: { locale: Locale; kind: "home" | "category" | "tag"; slug?: string; page: number; hasMore: boolean }) {
  if (page <= 1 && !hasMore) return null;
  const t = locale === "en" ? { prev: "← Newer", next: "Older →" } : { prev: "← Daha yeni", next: "Daha eski →" };
  return (
    <nav className="mt-16 flex justify-between font-display text-[0.9rem]" aria-label={locale === "en" ? "Pagination" : "Sayfalama"}>
      <span>{page > 1 && <Link className="link" href={href(locale, kind, { slug, page: page - 1 })}>{t.prev}</Link>}</span>
      <span>{hasMore && <Link className="link" href={href(locale, kind, { slug, page: page + 1 })}>{t.next}</Link>}</span>
    </nav>
  );
}
