import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import type { Locale } from "@/lib/db/schema";
import { getPublishedPosts } from "@/lib/db/queries/posts";
import { Pagination, PostList } from "@/components/site/PostList";
import { absolute, href } from "@/lib/seo/routes";

const loc = (l: string): Locale => (l === "en" ? "en" : "tr");

export async function generateMetadata({ params }: PageProps<"/[locale]/p/[n]">): Promise<Metadata> {
  const { locale: l, n } = await params;
  const locale = loc(l);
  return { title: `${locale === "en" ? "Page" : "Sayfa"} ${n}`, alternates: { canonical: absolute(href(locale, "home", { page: Number(n) })) } };
}

export default async function HomePage({ params }: PageProps<"/[locale]/p/[n]">) {
  const { locale: l, n } = await params;
  const locale = loc(l);
  const page = Number(n);
  if (!Number.isInteger(page) || page < 1) notFound();
  if (page === 1) permanentRedirect(href(locale, "home"));
  const { items, hasMore } = await getPublishedPosts(locale, page);
  if (items.length === 0) notFound();
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 md:px-0">
      <PostList items={items} locale={locale} />
      <Pagination locale={locale} kind="home" page={page} hasMore={hasMore} />
    </main>
  );
}
