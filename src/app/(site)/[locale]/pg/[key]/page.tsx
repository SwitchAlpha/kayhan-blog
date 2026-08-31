import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/lib/db/schema";
import { getPage, PAGE_KEYS, type PageKey } from "@/lib/db/queries/site";
import { absolute, href } from "@/lib/seo/routes";
import { SITE_AUTHOR } from "@/lib/site/config";

const loc = (l: string): Locale => (l === "en" ? "en" : "tr");
const isKey = (k: string): k is PageKey => (PAGE_KEYS as readonly string[]).includes(k);

export async function generateMetadata({ params }: PageProps<"/[locale]/pg/[key]">): Promise<Metadata> {
  const { locale: l, key } = await params;
  if (!isKey(key)) return {};
  const locale = loc(l);
  const page = await getPage(locale, key);
  if (!page) return {};
  return {
    title: page.title,
    alternates: { canonical: absolute(href(locale, key)), languages: { tr: absolute(href("tr", key)), en: absolute(href("en", key)), "x-default": absolute(href("tr", key)) } },
  };
}

export default async function StaticPage({ params }: PageProps<"/[locale]/pg/[key]">) {
  const { locale: l, key } = await params;
  if (!isKey(key)) notFound();
  const locale = loc(l);
  const page = await getPage(locale, key);
  if (!page) notFound();
  const profile = key === "about" ? { "@context": "https://schema.org", "@type": "ProfilePage", mainEntity: { "@type": "Person", name: SITE_AUTHOR, url: absolute(href(locale, "about")) } } : null;
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 md:px-0">
      {profile && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profile).replace(/</g, "\\u003c") }} />}
      <h1 className="font-display text-[2.2rem] font-semibold leading-tight tracking-tight">{page.title}</h1>
      <div className="prose-kb mt-8" dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
    </main>
  );
}
