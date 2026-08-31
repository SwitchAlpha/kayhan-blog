import type { Locale } from "@/lib/db/schema";
import { getPublishedPosts } from "@/lib/db/queries/posts";
import { Pagination, PostList } from "@/components/site/PostList";
import { description, tagline } from "@/lib/site/config";

const loc = (l: string): Locale => (l === "en" ? "en" : "tr");

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale: l } = await params;
  const locale = loc(l);
  const { items, hasMore } = await getPublishedPosts(locale, 1);
  const t = locale === "en"
    ? { empty: "Nothing here yet — the first note is on its way." }
    : { empty: "Henüz yazı yok; ilk not yolda." };
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 md:px-0">
      <section className="mb-14">
        <h1 className="font-display text-[2.4rem] font-semibold leading-[1.05] tracking-tight md:text-[3rem]">{tagline(locale)}</h1>
        <p className="mt-4 max-w-[46ch] text-[1.1rem] leading-relaxed text-ink-2">{description(locale)}</p>
      </section>
      {items.length === 0 && <p className="text-ink-3">{t.empty}</p>}
      <PostList items={items} locale={locale} />
      <Pagination locale={locale} kind="home" page={1} hasMore={hasMore} />
    </main>
  );
}
