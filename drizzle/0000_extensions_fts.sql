-- Extensions (self-hosted PG 17, superuser)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Turkish casefold: NFC, I→ı, İ→i, drop modifier letters (would otherwise become ASCII apostrophes).
-- C.UTF-8 lowercases I→i (not ı), so this must run before to_tsvector. See docs/research/04-deep-dives.md.
CREATE OR REPLACE FUNCTION tr_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT lower(translate(normalize(t, NFC), 'Iİʹʻʼʽˈ', 'ıi')) $$;

-- Fold diacritics AFTER stemming, preserving positions and weights.
-- Never chain unaccent before turkish_stem: it breaks vowel-harmony suffix stripping (gün, kız, gözlük...).
CREATE OR REPLACE FUNCTION tsv_fold(v tsvector) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT translate(v::text, 'çğıöşü', 'cgiosu')::tsvector $$;

CREATE OR REPLACE FUNCTION tsq_fold(q tsquery) RETURNS tsquery
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT translate(q::text, 'çğıöşü', 'cgiosu')::tsquery $$;

CREATE OR REPLACE FUNCTION tr_fold(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT translate(tr_norm(t), 'çğıöşü', 'cgiosu') $$;
