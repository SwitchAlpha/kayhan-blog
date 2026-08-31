import "server-only";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { postEmbeddings, postLocales } from "@/lib/db/schema";
import { EMBEDDING_DIMS, MODELS, openai, recordCall, reserveBudget, handleProviderError } from "./client";
import { sha256 } from "@/lib/content/derive";

export async function embedTexts(texts: string[], kind: "document" | "query"): Promise<number[][]> {
  if (texts.length === 0) return [];
  await reserveBudget();
  const t0 = Date.now();
  try {
    const res = await openai().embeddings.create({ model: MODELS.embedding, input: texts, dimensions: EMBEDDING_DIMS });
    await recordCall({ task: "embed", model: MODELS.embedding, inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: 0, durationMs: Date.now() - t0, status: "ok" });
    void kind;
    return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  } catch (e) {
    await recordCall({ task: "embed", model: MODELS.embedding, inputTokens: 0, outputTokens: 0, durationMs: Date.now() - t0, status: "error", error: e instanceof Error ? e.message : String(e) });
    return handleProviderError(e);
  }
}

/** Embed a post locale: one 'doc' vector (title+summary+lead) and one per paragraph ≥ 25 words. Skips unchanged paragraphs. */
export async function embedPostLocale(localeId: string) {
  const row = await db.query.postLocales.findFirst({ where: eq(postLocales.id, localeId) });
  if (!row) return;
  const paragraphs = (row.contentPlain.split("\n\n").map((t, i) => ({ i, t: t.trim() })).filter((p) => p.t.split(/\s+/).length >= 25));
  const docText = `${row.title}\n${row.summary}\n${row.contentPlain.slice(0, 1200)}`;
  const docHash = sha256(docText);
  const existing = await db.select({ kind: postEmbeddings.kind, paragraphIndex: postEmbeddings.paragraphIndex, paragraphHash: postEmbeddings.paragraphHash }).from(postEmbeddings).where(eq(postEmbeddings.postLocaleId, localeId));
  const have = new Map(existing.map((e) => [`${e.kind}:${e.paragraphIndex}`, e.paragraphHash]));

  const todo: { kind: "doc" | "para"; index: number; hash: string; text: string }[] = [];
  if (have.get("doc:-1") !== docHash) todo.push({ kind: "doc", index: -1, hash: docHash, text: docText });
  for (const p of paragraphs) {
    const h = sha256(p.t);
    if (have.get(`para:${p.i}`) !== h) todo.push({ kind: "para", index: p.i, hash: h, text: p.t });
  }
  // Drop stale paragraph rows.
  //
  // notInArray rather than a hand-written `<> ALL(...)`: drizzle binds a bare
  // array in a sql template element-by-element, so a post with one paragraph
  // produced `ALL(($3)::int[])` with $3 = 2 and Postgres rejected the scalar
  // ("malformed array literal"). Short posts are exactly the common case.
  const keep = paragraphs.map((p) => p.i);
  await db
    .delete(postEmbeddings)
    .where(
      and(
        eq(postEmbeddings.postLocaleId, localeId),
        eq(postEmbeddings.kind, "para"),
        // An empty list means every paragraph row is stale; notInArray([]) is
        // not valid SQL, so that case is expressed on its own.
        keep.length > 0 ? notInArray(postEmbeddings.paragraphIndex, keep) : undefined,
      ),
    );
  if (todo.length === 0) return { embedded: 0 };

  for (let i = 0; i < todo.length; i += 64) {
    const batch = todo.slice(i, i + 64);
    const vectors = await embedTexts(batch.map((b) => b.text), "document");
    for (let j = 0; j < batch.length; j++) {
      const b = batch[j];
      await db
        .insert(postEmbeddings)
        .values({ postLocaleId: localeId, kind: b.kind, paragraphIndex: b.index, paragraphHash: b.hash, model: MODELS.embedding, embedding: vectors[j] })
        .onConflictDoUpdate({ target: [postEmbeddings.postLocaleId, postEmbeddings.kind, postEmbeddings.paragraphIndex], set: { paragraphHash: b.hash, model: MODELS.embedding, embedding: vectors[j], createdAt: new Date() } });
    }
  }
  return { embedded: todo.length };
}
