import "server-only";
import OpenAI from "openai";
import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiCalls, aiCache, settings, type aiTaskEnum } from "@/lib/db/schema";

export type AiTask = (typeof aiTaskEnum.enumValues)[number];

const g = globalThis as unknown as { __kbOpenAI?: OpenAI };
export function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new AiDisabledError("OPENAI_API_KEY is not set");
  return (g.__kbOpenAI ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 2, timeout: 120_000 }));
}

export class AiDisabledError extends Error {}
export class BudgetExceededError extends Error {}

export const MODELS = {
  default: process.env.AI_MODEL_DEFAULT ?? "gpt-5.6-terra",
  linker: process.env.AI_MODEL_LINKER ?? process.env.AI_MODEL_DEFAULT ?? "gpt-5.6-luna",
  review: process.env.AI_MODEL_REVIEW ?? process.env.AI_MODEL_DEFAULT ?? "gpt-5.6-terra",
  translate: process.env.AI_MODEL_TRANSLATE ?? process.env.AI_MODEL_DEFAULT ?? "gpt-5.6-terra",
  embedding: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
};
export const EMBEDDING_DIMS = Number(process.env.EMBEDDING_DIMS ?? 1024);

/** Rough $/1M tokens for budget accounting (env-overridable; exact prices don't matter for the cap). */
const PRICE: Record<string, { in: number; out: number }> = {
  "gpt-5.6-sol": { in: 5, out: 25 }, "gpt-5.6-terra": { in: 2, out: 10 }, "gpt-5.6-luna": { in: 0.4, out: 2 }, "text-embedding-3-small": { in: 0.02, out: 0 },
};
export function costMicros(model: string, inTok: number, outTok: number): number {
  const p = PRICE[model] ?? { in: 2, out: 10 };
  return Math.round((inTok * p.in + outTok * p.out) * 1); // micros per token = $/1M tokens
}

export async function aiEnabled(): Promise<boolean> {
  if (process.env.AI_KILL_SWITCH === "1" || !process.env.OPENAI_API_KEY) return false;
  const paused = await db.query.settings.findFirst({ where: eq(settings.key, "ai.paused_until") });
  if (paused && new Date(paused.value as string) > new Date()) return false;
  return true;
}

/** Atomically reserve one call against today's budget; throws BudgetExceededError when exhausted. */
export async function reserveBudget(): Promise<void> {
  const maxCalls = Number(process.env.AI_DAILY_MAX_CALLS ?? 80);
  const maxCost = Math.round(Number(process.env.AI_DAILY_MAX_USD ?? 3) * 1_000_000);
  const r = await db.execute(sql`
    INSERT INTO ai_budget (day, calls, max_calls, max_cost_micros) VALUES (current_date, 1, ${maxCalls}, ${maxCost})
    ON CONFLICT (day) DO UPDATE SET calls = ai_budget.calls + 1
    WHERE ai_budget.calls < ai_budget.max_calls AND ai_budget.cost_micros < ai_budget.max_cost_micros
    RETURNING calls`);
  if (r.rows.length === 0) throw new BudgetExceededError("daily AI budget exhausted");
}

export async function recordCall(row: { task: AiTask; model: string; effort?: string; postLocaleId?: string | null; contentHash?: string; inputTokens: number; outputTokens: number; cached?: number; durationMs: number; status: "ok" | "error"; error?: string }) {
  const cost = costMicros(row.model, row.inputTokens, row.outputTokens);
  await db.insert(aiCalls).values({ task: row.task, model: row.model, effort: row.effort, postLocaleId: row.postLocaleId ?? null, contentHash: row.contentHash, inputTokens: row.inputTokens, outputTokens: row.outputTokens, cacheReadTokens: row.cached ?? 0, costMicros: cost, durationMs: row.durationMs, status: row.status, error: row.error });
  await db.execute(sql`UPDATE ai_budget SET input_tokens = input_tokens + ${row.inputTokens}, output_tokens = output_tokens + ${row.outputTokens}, cost_micros = cost_micros + ${cost} WHERE day = current_date`);
}

/** Non-retryable provider errors (spend limits, invalid key) pause AI until tomorrow. */
export async function handleProviderError(e: unknown): Promise<never> {
  const status = (e as { status?: number }).status;
  const msg = e instanceof Error ? e.message : String(e);
  if (status === 401 || status === 403 || /insufficient_quota|billing/i.test(msg)) {
    const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0);
    await db.insert(settings).values({ key: "ai.paused_until", value: tomorrow.toISOString() as unknown as object, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value: tomorrow.toISOString() as unknown as object, updatedAt: new Date() } });
  }
  throw e;
}

export async function cachedResult<T>(task: AiTask, contentHash: string, model: string, promptVersion: string): Promise<T | null> {
  const row = await db.query.aiCache.findFirst({ where: sql`${aiCache.task} = ${task} AND ${aiCache.contentHash} = ${contentHash} AND ${aiCache.model} = ${model} AND ${aiCache.promptVersion} = ${promptVersion}` });
  return (row?.result as T) ?? null;
}
export async function putCache(task: AiTask, contentHash: string, model: string, promptVersion: string, result: unknown) {
  await db.insert(aiCache).values({ task, contentHash, model, promptVersion, result: result as object }).onConflictDoUpdate({ target: [aiCache.task, aiCache.contentHash, aiCache.model, aiCache.promptVersion], set: { result: result as object, createdAt: new Date() } });
}
