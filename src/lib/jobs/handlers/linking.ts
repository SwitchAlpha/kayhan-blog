import "server-only";
import { embedPostLocale } from "@/lib/ai/embeddings";
import { afterLinking, linkSource, reverseLink } from "@/lib/ai/linker/run";
import { aiEnabled, BudgetExceededError, AiDisabledError } from "@/lib/ai/client";
import { revalidateViaLoopback } from "@/lib/cache/revalidate";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { postLocales } from "@/lib/db/schema";

/**
 * Translates a freshly published Turkish post and publishes the English one.
 *
 * Only fires for `tr`, which is also what stops this recursing: publishing the
 * English row queues another post.published job, and that job sees locale "en"
 * and translates nothing.
 *
 * Kept in its own error boundary so a translation failure — an exhausted budget,
 * a provider outage, an English post already live — never costs the Turkish post
 * the linking work that ran before it.
 */
async function autoTranslate(localeId: string) {
  const src = await db.query.postLocales.findFirst({ where: eq(postLocales.id, localeId) });
  if (!src || src.locale !== "tr") return { translated: false as const, reason: "not-tr" };

  const { translateToEnglish } = await import("@/lib/ai/translate");
  const { finalizePublish } = await import("@/lib/posts/publish");
  const en = await translateToEnglish(localeId);
  // finalizePublish is idempotent and handles revalidation and IndexNow itself.
  await finalizePublish(en.id, "auto-translate", revalidateViaLoopback);
  return { translated: true as const, enId: en.id, enSlug: en.slug };
}

/** publish → embed → forward link → reverse link → revalidate + IndexNow for touched posts. */
export async function postPublishedJob(localeId: string) {
  if (!(await aiEnabled())) return { skipped: "ai disabled" };

  let linking: Record<string, unknown>;
  let linkingError: unknown = null;
  try {
    const emb = await embedPostLocale(localeId);
    const fwd = await linkSource(localeId, { trigger: "publish" });
    const rev = await reverseLink(localeId, "publish");
    await afterLinking([...new Set([...fwd.touched, ...rev.touched])], revalidateViaLoopback);
    linking = { embedded: emb?.embedded ?? 0, forward: fwd.applied, reverse: rev.applied, rejected: fwd.rejected + rev.rejected };
  } catch (e) {
    if (e instanceof BudgetExceededError || e instanceof AiDisabledError) return { skipped: e.message };
    // Held, not thrown: linking and translation are independent, and an English
    // post should not be lost because the embedder failed. Rethrown below so the
    // job still retries and the failure stays visible.
    linking = { linkingFailed: true };
    linkingError = e;
  }

  let translation: Record<string, unknown>;
  try {
    translation = await autoTranslate(localeId);
  } catch (e) {
    translation = { translated: false, translateError: e instanceof Error ? e.message : String(e) };
  }

  // Translation is cached by content hash and finalizePublish is idempotent, so
  // the retry this triggers does not redo the work or republish anything.
  if (linkingError) throw linkingError;
  return { ...linking, ...translation };
}

/** content edited → re-embed and try forward links only (idempotent by input hash). */
export async function postRelinkJob(localeId: string) {
  if (!(await aiEnabled())) return { skipped: "ai disabled" };
  try {
    await embedPostLocale(localeId);
    const fwd = await linkSource(localeId, { trigger: "update" });
    await afterLinking(fwd.touched, revalidateViaLoopback);
    return { forward: fwd.applied, rejected: fwd.rejected, skipped: fwd.skipped };
  } catch (e) {
    if (e instanceof BudgetExceededError || e instanceof AiDisabledError) return { skipped: e.message };
    throw e;
  }
}
