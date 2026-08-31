import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import {
  MODELS,
  aiEnabled,
  cachedResult,
  handleProviderError,
  openai,
  putCache,
  recordCall,
  reserveBudget,
} from "../client";

export const SEO_PROMPT_VERSION = "seo-v1";

const Result = z.object({
  seo_title: z.string(),
  seo_description: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
});
export type { SeoFields } from "./clamp";
export { clampSeo } from "./clamp";
type Parsed = z.infer<typeof Result>;

const SYSTEM = (locale: "tr" | "en") => {
  const lang = locale === "tr" ? "Turkish" : "English";
  return `You write the search metadata for a post on a personal blog, in ${lang}.

seo_title: at most 60 characters. It is the same promise as the post's own title, not a keyword list, and never clickbait. If the author's title already works at that length, stay close to it.

seo_description: 120–160 characters. Say what the reader gets, in the post's own voice. No "in this article we will", no keyword stuffing, no invented claims — everything must be supported by the text you were given.

summary: one or two sentences for the post list and the RSS feed. Plainer than the description; it is read by someone browsing, not searching.

tags: 3 to 6 of them. Tags are recurring subjects that will group posts together over time — "React", "hata ayıklama", "üretkenlik" — never a phrase unique to this one post. Lowercase unless the tag is a proper noun.`;
};

/**
 * Writes the search metadata for a post from its own text.
 *
 * Only the fields the author left empty are ever taken from this — see
 * savePost. The model producing a better title than the one that was typed is
 * not a reason to replace it.
 */
export async function generateSeo(input: {
  locale: "tr" | "en";
  title: string;
  contentMd: string;
  contentHash: string;
}): Promise<Parsed | null> {
  if (!(await aiEnabled())) return null;

  const key = `${input.contentHash}:${input.locale}`;
  const hit = await cachedResult<Parsed>("summary", key, MODELS.default, SEO_PROMPT_VERSION);
  if (hit) return hit;

  await reserveBudget();
  const t0 = Date.now();
  try {
    const res = await openai().responses.parse({
      model: MODELS.default,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: SYSTEM(input.locale) },
        {
          role: "user",
          content: `TITLE: ${input.title}\n\nCONTENT (markdown):\n${input.contentMd.slice(0, 20_000)}`,
        },
      ],
      text: { format: zodTextFormat(Result, "seo_fields") },
    });
    const out = res.output_parsed;
    await recordCall({
      task: "summary",
      model: MODELS.default,
      effort: "low",
      contentHash: input.contentHash,
      inputTokens: res.usage?.input_tokens ?? 0,
      outputTokens: res.usage?.output_tokens ?? 0,
      durationMs: Date.now() - t0,
      status: "ok",
    });
    if (out) await putCache("summary", key, MODELS.default, SEO_PROMPT_VERSION, out);
    return out ?? null;
  } catch (e) {
    await recordCall({
      task: "summary",
      model: MODELS.default,
      effort: "low",
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - t0,
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    });
    await handleProviderError(e);
    return null;
  }
}
