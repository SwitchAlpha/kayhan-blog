import { afterAll, describe, expect, it } from "vitest";
import { q, testPool } from "./setup";

// Requires a migrated database (pnpm db:migrate) — see compose.dev.yml.
describe("Turkish full-text search primitives", () => {
  afterAll(() => testPool.end());

  it("tr_norm folds I→ı and İ→i regardless of C.UTF-8 casing", async () => {
    const [{ v }] = await q<{ v: string }>("SELECT tr_norm('IŞIK Işık ışık İstanbul') AS v");
    expect(v).toBe("ışık ışık ışık istanbul");
  });

  it("stems accented Turkish and matches diacritic-free queries after folding", async () => {
    const [{ ok }] = await q<{ ok: boolean }>(
      `SELECT tsv_fold(to_tsvector('turkish', tr_norm($1))) @@ tsq_fold(websearch_to_tsquery('turkish', tr_norm($2))) AS ok`,
      ["Işık günler ve gözlükler", "isik gun gozluk"],
    );
    expect(ok).toBe(true);
  });

  it("keeps weights/positions through tsv_fold (ts_rank_cd > 0)", async () => {
    const [{ rank }] = await q<{ rank: number }>(
      `SELECT ts_rank_cd(tsv_fold(setweight(to_tsvector('turkish', tr_norm('Gözlük seçimi')), 'A')),
                          tsq_fold(websearch_to_tsquery('turkish', tr_norm('gozluk'))), 32) AS rank`,
    );
    expect(rank).toBeGreaterThan(0);
  });

  it("normalizer functions are IMMUTABLE (usable in generated columns)", async () => {
    const rows = await q<{ proname: string; provolatile: string }>(
      `SELECT proname, provolatile FROM pg_proc WHERE proname IN ('tr_norm','tsv_fold','tsq_fold','tr_fold')`,
    );
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.provolatile).toBe("i");
  });

  it("post_locales generated search columns exist", async () => {
    const rows = await q<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='post_locales' AND column_name IN ('search_tsv','title_fold')`,
    );
    expect(rows.map((r) => r.column_name).sort()).toEqual(["search_tsv", "title_fold"]);
  });

  // pg_dump writes `SET search_path = ''` into every dump, so a restore recomputes
  // the post_locales generated columns with no schema on the path. A normalizer
  // that calls another one unqualified fails there, the COPY for that table is
  // skipped, and pg_restore still exits 0 — the backup silently restores empty.
  // Regression guard for migration 0007; see deploy/RESTORE.md.
  it("normalizers resolve under the empty search_path a restore uses", async () => {
    const client = await testPool.connect();
    try {
      await client.query("SET search_path = ''");
      const { rows } = await client.query<{ folded: string }>(
        "SELECT public.tr_fold('Gözlükler İSTANBUL') AS folded",
      );
      expect(rows[0].folded).toBe("gozlukler istanbul");
    } finally {
      client.release();
    }
  });
});
