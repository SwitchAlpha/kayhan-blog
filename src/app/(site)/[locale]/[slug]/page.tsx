import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/client";
import { redirects, type Locale } from "@/lib/db/schema";
import { getPublishedPostBySlug } from "@/lib/db/queries/posts";
import { tags } from "@/lib/cache/tags";
import { absolute, href } from "@/lib/seo/routes";
import { headers, cookies } from "next/headers";
import { AdUnit } from "@/components/ads/AdUnit";
import { ADS_ENABLED, SLOTS } from "@/lib/ads/config";
import { CONSENT_COOKIE, consentGranted } from "@/lib/consent/config";
import { splitHtmlForAds } from "@/lib/content/ad-positions";
import { CoverImage, coverUrls } from "@/components/site/CoverImage";
import { DateStamp } from "@/components/site/PostList";
import { variantUrl } from "@/lib/media/pipeline";
import { llmsPath } from "@/lib/seo/llms";
import { SITE_AUTHOR, SITE_NAME } from "@/lib/site/config";

const getRedirect = (path: string) =>
  unstable_cache(async () => db.query.redirects.findFirst({ where: eq(redirects.fromPath, path) }) ?? null, ["redirect", path], { tags: [tags.redirects] })();

function loc(l: string): Locale { return l === "en" ? "en" : "tr"; }

export async function generateMetadata({ params }: PageProps<"/[locale]/[slug]">): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = loc(l);
  const post = await getPublishedPostBySlug(locale, slug);
  if (!post) return {};
  const url = absolute(href(locale, "post", { slug }));
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.summary,
    alternates: { canonical: url, types: { "text/markdown": absolute(llmsPath(locale, slug)) } },
    openGraph: {
      type: "article", locale: locale === "en" ? "en_US" : "tr_TR", siteName: SITE_NAME, url, title: post.seoTitle ?? post.title, description: post.seoDescription ?? post.summary,
      publishedTime: post.publishedAt?.toISOString(), modifiedTime: (post.contentUpdatedAt ?? post.publishedAt)?.toISOString(), authors: [absolute(href(locale, "about"))],
      section: locale === "en" ? post.post.category.nameEn : post.post.category.nameTr,
      images: post.post.cover
        ? [{ url: variantUrl(post.post.cover.variants[post.post.cover.variants.length - 1].key), width: post.post.cover.width, height: post.post.cover.height, alt: post.title }]
        : [{ url: absolute(`/og/${locale}/${slug}.png?v=${post.contentHash.slice(0, 12)}`), width: 1200, height: 630, alt: post.title }],
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  };
}

export default async function PostPage({ params }: PageProps<"/[locale]/[slug]">) {
  const { locale: l, slug } = await params;
  const locale = loc(l);
  const post = await getPublishedPostBySlug(locale, slug);
  if (!post) {
    const r = await getRedirect(href(locale, "post", { slug }));
    if (r?.statusCode === 301 && r.toPath) permanentRedirect(r.toPath);
    notFound();
  }
  const dateFmt = locale === "en" ? "en-US" : "tr-TR";
  const bucket = (await headers()).get("x-geo-bucket") ?? "row";
  const adsAllowed = ADS_ENABLED && (bucket === "eea" || bucket === "row" || consentGranted((await cookies()).get(CONSENT_COOKIE)?.value));
  const parts = ADS_ENABLED ? splitHtmlForAds(post.contentHtml, post.wordCount) : [post.contentHtml];
  const modified = post.contentUpdatedAt && post.publishedAt && post.contentUpdatedAt.getTime() - post.publishedAt.getTime() > 86_400_000 ? post.contentUpdatedAt : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    ...(post.post.cover ? { image: coverUrls(post.post.cover) } : {}),
    datePublished: post.publishedAt?.toISOString(),
    dateModified: (post.contentUpdatedAt ?? post.publishedAt)?.toISOString(),
    author: { "@type": "Person", name: SITE_AUTHOR, url: absolute(href(locale, "about")) },
    inLanguage: locale,
    mainEntityOfPage: absolute(href(locale, "post", { slug })),
    articleSection: locale === "en" ? post.post.category.nameEn : post.post.category.nameTr,
    wordCount: post.wordCount,
  };
  const catName = locale === "en" ? post.post.category.nameEn : post.post.category.nameTr;
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 md:px-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="notebook">
        <header className="relative mb-8">
          <DateStamp date={post.publishedAt} locale={locale} className="mb-3 block md:mb-0" />
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-3">
            <Link href={href(locale, "category", { slug: locale === "en" ? post.post.category.slugEn : post.post.category.slugTr })} className="hover:text-pen">{catName}</Link>
            <span aria-hidden> · </span>{Math.max(1, Math.round(post.readingTimeSec / 60))} {locale === "en" ? "min read" : "dk okuma"}
          </p>
          <h1 className="mt-2 font-display text-[2.1rem] font-semibold leading-[1.1] tracking-tight md:text-[2.6rem]">{post.title}</h1>
          {post.summary && <p className="mt-4 text-[1.15rem] leading-relaxed text-ink-2">{post.summary}</p>}
          <p className="mt-4 font-display text-[0.85rem] text-ink-3">
            <Link href={href(locale, "about")} rel="author" className="text-ink-2 hover:text-ink">{SITE_AUTHOR}</Link>
            {modified && <> <span aria-hidden>·</span> {locale === "en" ? "Updated" : "Güncellendi"} <time dateTime={modified.toISOString()}>{modified.toLocaleDateString(dateFmt, { dateStyle: "long" })}</time></>}
          </p>
        </header>
        {post.post.cover && <CoverImage cover={post.post.cover} locale={locale} sizes="(max-width: 768px) 100vw, 720px" priority className="mb-10 aspect-video w-full rounded-lg object-cover" />}
        {parts.map((html, i) => (
          <div key={i}>
            <div className="prose-kb" dangerouslySetInnerHTML={{ __html: html }} />
            {ADS_ENABLED && i < parts.length - 1 && <AdUnit slot={i === 0 ? SLOTS.in1 : SLOTS.in2} variant="in-article" initiallyAllowed={adsAllowed} />}
          </div>
        ))}
        {ADS_ENABLED && <AdUnit slot={SLOTS.end} variant="end" initiallyAllowed={adsAllowed} />}
      </article>
    </main>
  );
}
