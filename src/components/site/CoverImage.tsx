import { srcsetFor, variantUrl } from "@/lib/media/pipeline";

type Cover = { variants: { w: number; key: string }[]; width: number; height: number; blurDataUrl: string | null; altTr: string | null; altEn: string | null };

/** Pre-generated WebP variants, served from the CDN host; explicit dimensions keep CLS at zero. */
export function CoverImage({ cover, locale, sizes, priority = false, className = "" }: { cover: Cover; locale: "tr" | "en"; sizes: string; priority?: boolean; className?: string }) {
  const largest = cover.variants[cover.variants.length - 1];
  const alt = (locale === "en" ? cover.altEn : cover.altTr) ?? "";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={variantUrl(largest.key)}
      srcSet={srcsetFor(cover.variants)}
      sizes={sizes}
      width={cover.width}
      height={cover.height}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={className}
      style={cover.blurDataUrl ? { backgroundImage: `url(${cover.blurDataUrl})`, backgroundSize: "cover" } : undefined}
    />
  );
}

export function coverUrls(cover: Cover | null | undefined): string[] {
  if (!cover) return [];
  return cover.variants.map((v) => variantUrl(v.key));
}
