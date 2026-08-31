-- tr_fold called tr_norm without a schema, so it only resolved while `public`
-- was in search_path. pg_dump writes `SET search_path = ''` into its output
-- (CVE-2018-1058 hardening), so restoring a dump recomputes the post_locales
-- generated columns with an empty search_path, tr_norm is not found, the COPY
-- for that table fails, and pg_restore -- which ignores errors by default --
-- leaves post_locales EMPTY while reporting success.
--
-- That silently made every backup unrestorable for the one table holding all
-- post content. Qualifying the call is enough; tr_norm, tsv_fold and tsq_fold
-- only use built-ins from pg_catalog, which is always implicitly searched.
CREATE OR REPLACE FUNCTION public.tr_fold(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT translate(public.tr_norm(t), 'çğıöşü', 'cgiosu') $$;
