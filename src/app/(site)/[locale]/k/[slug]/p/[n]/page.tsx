import { notFound, permanentRedirect } from "next/navigation";
import type { Locale } from "@/lib/db/schema";
import { getCategoryPage } from "@/lib/db/queries/site";
import { Pagination, PostList } from "@/components/site/PostList";
import { href } from "@/lib/seo/routes";

export default async function CategoryPaged({ params }: PageProps<"/[locale]/k/[slug]/p/[n]">) {
  const { locale: l, slug, n } = await params;
  const locale: Locale = l === "en" ? "en" : "tr";
  const page = Number(n);
  if (!Number.isInteger(page) || page < 1) notFound();
  if (page === 1) permanentRedirect(href(locale, "category", { slug }));
  const data = await getCategoryPage(locale, slug, page);
  if (!data || data.items.length === 0) notFound();
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 md:px-0">
      <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight">{locale === "en" ? data.category.nameEn : data.category.nameTr} — {locale === "en" ? "Page" : "Sayfa"} {page}</h1>
      <div className="mt-12"><PostList items={data.items} locale={locale} /></div>
      <Pagination locale={locale} kind="category" slug={slug} page={page} hasMore={data.hasMore} />
    </main>
  );
}
