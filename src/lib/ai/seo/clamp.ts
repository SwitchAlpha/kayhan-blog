export type SeoFields = {
  seo_title: string;
  seo_description: string;
  summary: string;
  tags: string[];
};

/**
 * Trims and caps model output to the column limits in postLocales.
 *
 * Kept free of `server-only` and the OpenAI client so it can be unit-tested.
 * Its job is that a long or padded answer degrades to a shorter one rather than
 * failing the author's save.
 */
export function clampSeo(out: SeoFields): SeoFields {
  return {
    seo_title: out.seo_title.trim().slice(0, 120),
    seo_description: out.seo_description.trim().slice(0, 300),
    summary: out.summary.trim().slice(0, 500),
    tags: out.tags.map((t) => t.trim()).filter(Boolean).slice(0, 6),
  };
}
