import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import type { Candidate } from "./guards";

/**
 * Candidate targets for source locale row S: doc-embedding cosine neighbours (same locale, published, not self),
 * excluding active/recently-reverted pairs and over-linked targets. Falls back to FTS title matching when
 * no embeddings exist (e.g. no OpenAI key yet).
 */
export async function findCandidates(sourceLocaleId: string, limit = 15): Promise<Candidate[]> {
  const byVector = await db.execute(sql`
    WITH src AS (SELECT pl.id, pl.locale, pl.post_id, e.embedding FROM post_locales pl
                 LEFT JOIN post_embeddings e ON e.post_locale_id = pl.id AND e.kind = 'doc' WHERE pl.id = ${sourceLocaleId})
    SELECT t.id AS "localeId", t.slug, t.title, t.summary,
           CASE WHEN src.embedding IS NULL OR te.embedding IS NULL THEN NULL ELSE 1 - (te.embedding <=> src.embedding) END AS similarity
    FROM src
    JOIN post_locales t ON t.locale = src.locale AND t.status = 'published' AND t.published_at <= now() AND t.post_id <> src.post_id
    LEFT JOIN post_embeddings te ON te.post_locale_id = t.id AND te.kind = 'doc'
    WHERE NOT EXISTS (SELECT 1 FROM applied_links al WHERE al.source_locale_id = src.id AND al.target_locale_id = t.id
                      AND (al.reverted_at IS NULL OR al.reverted_at > now() - interval '90 days'))
      AND (SELECT count(*) FROM applied_links al2 WHERE al2.target_locale_id = t.id AND al2.reverted_at IS NULL) < 45
    ORDER BY similarity DESC NULLS LAST, t.published_at DESC
    LIMIT ${limit * 2}`);
  const rows = byVector.rows as { localeId: string; slug: string; title: string; summary: string; similarity: number | null }[];
  const withSim = rows.filter((r) => r.similarity !== null && r.similarity >= 0.35).map((r) => ({ ...r, similarity: Number(r.similarity) }));
  if (withSim.length >= 3) return withSim.slice(0, limit);
  // FTS fallback: target title phrase appears in the source text
  const fts = await db.execute(sql`
    SELECT t.id AS "localeId", t.slug, t.title, t.summary
    FROM post_locales s JOIN post_locales t ON t.locale = s.locale AND t.status = 'published' AND t.post_id <> s.post_id
    WHERE s.id = ${sourceLocaleId}
      AND s.search_tsv @@ (CASE WHEN s.locale = 'en' THEN plainto_tsquery('english', t.title) ELSE tsq_fold(plainto_tsquery('turkish', tr_norm(t.title))) END)
      AND NOT EXISTS (SELECT 1 FROM applied_links al WHERE al.source_locale_id = s.id AND al.target_locale_id = t.id AND al.reverted_at IS NULL)
    LIMIT ${limit}`);
  const seen = new Set(withSim.map((c) => c.localeId));
  const extra = (fts.rows as { localeId: string; slug: string; title: string; summary: string }[]).filter((r) => !seen.has(r.localeId)).map((r) => ({ ...r, similarity: 0.5 }));
  return [...withSim, ...extra].slice(0, limit);
}

/** Older published posts (same locale) that are most similar to the NEW post — used for reverse linking. */
export async function findReverseSources(targetLocaleId: string, limit = 8): Promise<Candidate[]> {
  const r = await db.execute(sql`
    WITH tgt AS (SELECT pl.id, pl.locale, pl.post_id, e.embedding FROM post_locales pl JOIN post_embeddings e ON e.post_locale_id = pl.id AND e.kind = 'doc' WHERE pl.id = ${targetLocaleId})
    SELECT s.id AS "localeId", s.slug, s.title, s.summary, 1 - (se.embedding <=> tgt.embedding) AS similarity
    FROM tgt JOIN post_locales s ON s.locale = tgt.locale AND s.status = 'published' AND s.post_id <> tgt.post_id
    JOIN post_embeddings se ON se.post_locale_id = s.id AND se.kind = 'doc'
    WHERE NOT EXISTS (SELECT 1 FROM applied_links al WHERE al.source_locale_id = s.id AND al.target_locale_id = tgt.id AND (al.reverted_at IS NULL OR al.reverted_at > now() - interval '90 days'))
      AND 1 - (se.embedding <=> tgt.embedding) >= 0.55
    ORDER BY similarity DESC LIMIT ${limit}`);
  return (r.rows as Candidate[]).map((c) => ({ ...c, similarity: Number(c.similarity) }));
}
