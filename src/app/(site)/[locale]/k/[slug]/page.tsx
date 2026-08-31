import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/lib/db/schema";
import { getCategoryPage } from "@/lib/db/queries/site";
import { Pagination, PostList } from "@/components/site/PostList";
import { absolute, href } from "@/lib/seo/routes";

const loc = (l: string): Locale => (l === "en" ? "en" : "tr");

export async function generateMetadata({ params }: PageProps<"/[locale]/k/[slug]">): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = loc(l);
  const data = await getCategoryPage(locale, slug, 1);
  if (!data) return {};
  const name = locale === "en" ? data.category.nameEn : data.category.nameTr;
  const other = locale === "en" ? data.category.slugTr : data.category.slugEn;
  return {
    title: locale === "en" ? `${name} posts` : `${name} yazıları`,
    description: (locale === "en" ? data.category.descriptionEn : data.category.descriptionTr) ?? undefined,
    alternates: {
      canonical: absolute(href(locale, "category", { slug })),
      languages: { tr: absolute(href("tr", "category", { slug: locale === "tr" ? slug : other })), en: absolute(href("en", "category", { slug: locale === "en" ? slug : other })), "x-default": absolute(href("tr", "category", { slug: locale === "tr" ? slug : other })) },
    },
  };
}

export default async function CategoryPage({ params }: PageProps<"/[locale]/k/[slug]">) {
  const { locale: l, slug } = await params;
  const locale = loc(l);
  const data = await getCategoryPage(locale, slug, 1);
  if (!data) notFound();
  const name = locale === "en" ? data.category.nameEn : data.category.nameTr;
  const desc = locale === "en" ? data.category.descriptionEn : data.category.descriptionTr;
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 md:px-0">
      <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight">{name}</h1>
      {desc && <p className="mt-3 max-w-[50ch] text-ink-2">{desc}</p>}
      <div className="mt-12"><PostList items={data.items} locale={locale} /></div>
      <Pagination locale={locale} kind="category" slug={slug} page={1} hasMore={data.hasMore} />
    </main>
  );
}
