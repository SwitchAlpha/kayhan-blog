import type { Metadata } from "next";
import Link from "next/link";
import type { Locale } from "@/lib/db/schema";
import { searchPosts } from "@/lib/db/queries/site";
import { href } from "@/lib/seo/routes";

export const metadata: Metadata = { robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function SearchPage({ params, searchParams }: PageProps<"/[locale]/s">) {
  const { locale: l } = await params;
  const locale: Locale = l === "en" ? "en" : "tr";
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const results = q ? await searchPosts(locale, q) : [];
  const t = locale === "en" ? { title: "Search", ph: "Search posts…", none: "No results.", btn: "Search" } : { title: "Arama", ph: "Yazılarda ara…", none: "Sonuç bulunamadı.", btn: "Ara" };
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 md:px-0">
      <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight">{t.title}</h1>
      <form action={href(locale, "search")} method="get" className="mt-6 flex gap-2">
        <input name="q" defaultValue={q} placeholder={t.ph} className="input" maxLength={100} />
        <button className="btn btn-primary">{t.btn}</button>
      </form>
      {q && results.length === 0 && <p className="mt-8 text-ink-3">{t.none}</p>}
      <ul className="mt-10 space-y-8">
        {results.map((r) => (
          <li key={r.id}>
            <h2 className="font-display text-[1.3rem] font-semibold leading-snug"><Link className="title-link" href={href(locale, "post", { slug: r.slug })}>{r.title}</Link></h2>
            <p className="mt-1 text-ink-2">{r.summary}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
