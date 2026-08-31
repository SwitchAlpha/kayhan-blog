import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/lib/db/schema";
import { getTagPage } from "@/lib/db/queries/site";
import { Pagination, PostList } from "@/components/site/PostList";
import { absolute, href } from "@/lib/seo/routes";

const loc = (l: string): Locale => (l === "en" ? "en" : "tr");
const INDEX_MIN_POSTS = 4;

export async function generateMetadata({ params }: PageProps<"/[locale]/t/[slug]">): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = loc(l);
  const data = await getTagPage(locale, slug, 1);
  if (!data) return {};
  const name = (locale === "en" ? data.tag.nameEn : data.tag.nameTr) ?? data.tag.nameTr;
  const intro = locale === "en" ? data.tag.introEn : data.tag.introTr;
  const indexable = data.total >= INDEX_MIN_POSTS && Boolean(intro);
  return { title: name, description: intro ?? undefined, alternates: { canonical: absolute(href(locale, "tag", { slug })) }, robots: indexable ? { index: true, follow: true } : { index: false, follow: true } };
}

export default async function TagPage({ params }: PageProps<"/[locale]/t/[slug]">) {
  const { locale: l, slug } = await params;
  const locale = loc(l);
  const data = await getTagPage(locale, slug, 1);
  if (!data || data.items.length === 0) notFound();
  const name = (locale === "en" ? data.tag.nameEn : data.tag.nameTr) ?? data.tag.nameTr;
  const intro = locale === "en" ? data.tag.introEn : data.tag.introTr;
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 md:px-0">
      <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight">#{name}</h1>
      {intro && <p className="mt-3 max-w-[50ch] text-ink-2">{intro}</p>}
      <div className="mt-12"><PostList items={data.items} locale={locale} /></div>
      <Pagination locale={locale} kind="tag" slug={slug} page={1} hasMore={data.hasMore} />
    </main>
  );
}
