import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { JSONContent } from "@tiptap/core";
import { deriveContent } from "@/lib/content/derive";
import { markdownToDoc } from "@/lib/content/markdown";
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

export const ENHANCE_PROMPT_VERSION = "enhance-v1";

const Result = z.object({
  body_markdown: z.string(),
  /** What was changed and why, so the author can judge without diffing. */
  notes: z.array(z.string()),
});

const SYSTEM = (locale: "tr" | "en") => {
  const lang = locale === "tr" ? "Turkish" : "English";
  return `You are editing a post on someone's personal blog, written in ${lang}. Return the edited post in ${lang} as markdown.

You are a copy editor, not a co-author. The voice is the author's and must survive: their rhythm, their word choices, their asides, their bluntness. A reader who knows their writing should not be able to tell an editor passed over it.

Do:
- Fix awkward phrasing, unclear pronouns, run-on sentences and repetition.
- Tighten sentences that circle a point before making it.
- Add a heading only where the text already changes subject.

Do not:
- Add facts, examples, opinions, statistics or conclusions that are not already in the text. If a claim is not there, it does not go in.
- Pad. Never add words to make the piece longer — a short post that says its piece is finished, and filler is worse than brevity.
- Replace concrete first-person detail with generic phrasing.
- Introduce the vocabulary of AI-written prose: "moreover", "in today's fast-paced", "it is important to note", "delve", "landscape", "furthermore", or their ${lang} equivalents.
- Change what the author claims, even if you think it is wrong. Editing is not correcting.

Keep all code blocks, links, images and their markdown exactly as they are.

notes: one short line per meaningful change, in ${lang}.`;
};

export type EnhanceResult = { markdown: string; notes: string[] };

/**
 * Rewrites a post for clarity, in the author's voice.
 *
 * Operates on the document it is handed — the editor's current content — not on
 * whatever was last saved. Reading from the database instead would quietly
 * discard the edits made since the last save, which is the sort of loss a
 * "make it better" button must never cause.
 *
 * Returns a proposal. Nothing is written here: applying it is the caller's
 * decision, and the author's save is what makes it real.
 */
export async function enhanceText(input: {
  locale: "tr" | "en";
  doc: JSONContent;
}): Promise<EnhanceResult | null> {
  if (!(await aiEnabled())) return null;

  const derived = await deriveContent(input.doc, input.locale);
  if (derived.wordCount < 20) return null;

  const key = `${derived.contentHash}:${input.locale}`;
  const hit = await cachedResult<EnhanceResult>(
    "enhance",
    key,
    MODELS.default,
    ENHANCE_PROMPT_VERSION,
  );
  if (hit) return hit;

  await reserveBudget();
  const t0 = Date.now();
  try {
    const res = await openai().responses.parse({
      model: MODELS.default,
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: SYSTEM(input.locale) },
        { role: "user", content: derived.md.slice(0, 30_000) },
      ],
      text: { format: zodTextFormat(Result, "enhanced") },
    });
    const out = res.output_parsed;
    await recordCall({
      task: "enhance",
      model: MODELS.default,
      effort: "medium",
      contentHash: derived.contentHash,
      inputTokens: res.usage?.input_tokens ?? 0,
      outputTokens: res.usage?.output_tokens ?? 0,
      durationMs: Date.now() - t0,
      status: "ok",
    });
    if (!out) return null;
    const result: EnhanceResult = { markdown: out.body_markdown, notes: out.notes };
    await putCache("enhance", key, MODELS.default, ENHANCE_PROMPT_VERSION, result);
    return result;
  } catch (e) {
    await recordCall({
      task: "enhance",
      model: MODELS.default,
      effort: "medium",
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

/** Markdown proposal → editor document. */
export function enhancedDoc(markdown: string): JSONContent {
  return markdownToDoc(markdown);
}
