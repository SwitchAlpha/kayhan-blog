import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema";
import { toSlug } from "@/lib/content/slug";
import { isNearDuplicate } from "./dedupe";
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

export const CATEGORIZE_PROMPT_VERSION = "categorize-v1";

const Result = z.object({
  /** slug_tr of an existing category, or null when none of them fit. */
  existing_slug: z.string().nullable(),
  /** Only read when existing_slug is null. */
  new_category: z
    .object({ name_tr: z.string(), name_en: z.string(), reason: z.string() })
    .nullable(),
  confidence: z.number(),
});
type LlmResult = z.infer<typeof Result>;

const SYSTEM = `You file blog posts into categories for a personal blog about software, work and learning.

Prefer an existing category. Reuse one whenever the post plausibly belongs there — a blog with eight useful categories is far better than one with thirty precise ones, and a slightly loose fit is not a reason to invent a new category.

Only propose a new category when the post is about a subject the existing list genuinely does not cover, and when you would expect the author to write about that subject again. A category that will hold exactly one post is not a category.

Categories are broad subjects, never article titles: "Yazılım" not "React 19'da useEffect".

Answer with existing_slug set to the slug of the chosen category, or existing_slug null and new_category filled in. confidence is 0..1 for how well the post fits your answer.`;

export type CategorizeOutcome =
  | { kind: "existing"; categoryId: string; slug: string; confidence: number }
  | { kind: "created"; categoryId: string; slug: string; confidence: number }
  | { kind: "skipped"; reason: string };

/**
 * Picks a category for a post from its own text, creating one only when the
 * existing set genuinely does not cover it.
 *
 * Called from savePost when the author left the category on "auto". It never
 * runs when a category was chosen by hand: a deliberate choice outranks a
 * guess, and silently reassigning someone's post is the one behaviour that
 * would make this feature untrustworthy.
 */
export async function categorizePost(input: {
  title: string;
  summary: string;
  contentMd: string;
  contentHash: string;
}): Promise<CategorizeOutcome> {
  if (!(await aiEnabled())) return { kind: "skipped", reason: "ai-disabled" };

  // An empty list is not a reason to give up — a brand-new blog's first post is
  // exactly when a category has to be invented.
  const all = await db.query.categories.findMany();

  const key = `${input.contentHash}:${all.length}`;
  let parsed = await cachedResult<LlmResult>(
    "categorize",
    key,
    MODELS.default,
    CATEGORIZE_PROMPT_VERSION,
  );

  if (!parsed) {
    await reserveBudget();
    const t0 = Date.now();
    try {
      const list = all.length
        ? all
            .map((c) => `- ${c.slugTr} — ${c.nameTr} / ${c.nameEn}${c.descriptionTr ? `: ${c.descriptionTr}` : ""}`)
            .join("\n")
        : "(none yet — this is the blog's first post, so propose the category it belongs in)";
      const res = await openai().responses.parse({
        model: MODELS.default,
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `EXISTING CATEGORIES:\n${list}\n\nPOST TITLE: ${input.title}\nSUMMARY: ${input.summary || "-"}\n\nCONTENT (markdown):\n${input.contentMd.slice(0, 12_000)}`,
          },
        ],
        text: { format: zodTextFormat(Result, "categorization") },
      });
      parsed = res.output_parsed;
      await recordCall({
        task: "categorize",
        model: MODELS.default,
        effort: "low",
        contentHash: input.contentHash,
        inputTokens: res.usage?.input_tokens ?? 0,
        outputTokens: res.usage?.output_tokens ?? 0,
        durationMs: Date.now() - t0,
        status: "ok",
      });
      if (parsed) {
        await putCache("categorize", key, MODELS.default, CATEGORIZE_PROMPT_VERSION, parsed);
      }
    } catch (e) {
      await recordCall({
        task: "categorize",
        model: MODELS.default,
        effort: "low",
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - t0,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
      await handleProviderError(e);
    }
  }

  if (!parsed) return { kind: "skipped", reason: "no-result" };

  if (parsed.existing_slug) {
    const hit = all.find((c) => c.slugTr === parsed.existing_slug);
    if (hit) {
      return { kind: "existing", categoryId: hit.id, slug: hit.slugTr, confidence: parsed.confidence };
    }
    // Model named a category that does not exist — fall through rather than
    // trusting a slug it invented.
  }

  const proposal = parsed.new_category;
  if (!proposal) return { kind: "skipped", reason: "no-choice" };

  // Second guard, after the prompt's own instruction: the model proposing a
  // near-synonym is the failure mode that turns a category list into noise.
  const clash = isNearDuplicate(proposal.name_tr, all.map((c) => c.slugTr));
  if (clash) {
    const hit = all.find((c) => c.slugTr === clash)!;
    return { kind: "existing", categoryId: hit.id, slug: hit.slugTr, confidence: parsed.confidence };
  }

  const slugTr = toSlug(proposal.name_tr);
  const slugEn = toSlug(proposal.name_en) || slugTr;
  if (!slugTr) return { kind: "skipped", reason: "bad-slug" };

  const [row] = await db
    .insert(categories)
    .values({
      nameTr: proposal.name_tr,
      nameEn: proposal.name_en,
      slugTr,
      slugEn,
      sort: all.length,
    })
    // A concurrent save could have created the same one a moment ago.
    .onConflictDoUpdate({ target: categories.slugTr, set: { nameTr: proposal.name_tr } })
    .returning({ id: categories.id });

  return { kind: "created", categoryId: row.id, slug: slugTr, confidence: parsed.confidence };
}
