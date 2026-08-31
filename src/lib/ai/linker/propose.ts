import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { MODELS, openai, recordCall, reserveBudget, handleProviderError } from "../client";
import { LINKER_SYSTEM } from "../prompts/linker";
import type { Candidate, Proposal } from "./guards";

// No minLength/maxLength/min/max constraints: structured-output schemas are validated in code (guards).
const ProposalSchema = z.object({
  proposals: z.array(z.object({
    target_slug: z.string(),
    paragraph_index: z.number().int(),
    anchor_text: z.string(),
    confidence: z.number(),
    rationale: z.string(),
  })),
});

export async function proposeLinks(input: {
  locale: "tr" | "en";
  sourceTitle: string;
  paragraphs: { index: number; text: string }[];
  candidates: Candidate[];
  anchorsUsed: Record<string, string[]>; // target slug → folded anchors already used
  maxLinks: number;
  postLocaleId?: string;
}): Promise<{ proposals: Proposal[]; usage: { input: number; output: number }; model: string }> {
  if (input.candidates.length === 0 || input.paragraphs.length === 0 || input.maxLinks <= 0) return { proposals: [], usage: { input: 0, output: 0 }, model: MODELS.linker };
  await reserveBudget();
  const doc = input.paragraphs.map((p) => `[${p.index}] ${p.text}`).join("\n\n");
  const cands = input.candidates
    .map((c) => `- slug: ${c.slug}\n  title: ${c.title}\n  summary: ${c.summary || "-"}\n  anchors_already_used: ${(input.anchorsUsed[c.slug] ?? []).join(" | ") || "-"}`)
    .join("\n");
  const user = `SOURCE TITLE: ${input.sourceTitle}\n\nSOURCE PARAGRAPHS (numbered):\n${doc}\n\nCANDIDATES:\n${cands}\n\nReturn at most ${input.maxLinks} proposals.`;
  const t0 = Date.now();
  try {
    const res = await openai().responses.parse({
      model: MODELS.linker,
      reasoning: { effort: "low" },
      input: [{ role: "system", content: LINKER_SYSTEM(input.locale) }, { role: "user", content: user }],
      text: { format: zodTextFormat(ProposalSchema, "link_proposals") },
    });
    const usage = { input: res.usage?.input_tokens ?? 0, output: res.usage?.output_tokens ?? 0 };
    await recordCall({ task: "link", model: MODELS.linker, effort: "low", postLocaleId: input.postLocaleId, inputTokens: usage.input, outputTokens: usage.output, durationMs: Date.now() - t0, status: "ok" });
    return { proposals: res.output_parsed?.proposals ?? [], usage, model: MODELS.linker };
  } catch (e) {
    await recordCall({ task: "link", model: MODELS.linker, effort: "low", postLocaleId: input.postLocaleId, inputTokens: 0, outputTokens: 0, durationMs: Date.now() - t0, status: "error", error: e instanceof Error ? e.message : String(e) });
    return handleProviderError(e);
  }
}
