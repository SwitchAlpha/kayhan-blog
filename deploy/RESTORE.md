# Restoring from a backup

1. `cd /opt/stacks/<stack> && docker compose -f compose.yml -f compose.nginx.yml stop app`
2. Fetch the dump: `rclone copy r2:kb-backups/db/daily/db-YYYY-MM-DD.dump /tmp/`
3. Restore, dropping the existing schema:
   `docker compose -f compose.yml -f compose.nginx.yml exec -T db pg_restore -U kb -d "$POSTGRES_DB" --clean --if-exists --no-owner < /tmp/db-YYYY-MM-DD.dump`
4. Media: `rclone sync r2:kb-backups/media $(docker inspect $(docker compose -f compose.yml -f compose.nginx.yml ps -q app) -f '{{range .Mounts}}{{if eq .Destination "/data/uploads"}}{{.Source}}{{end}}{{end}}')`
5. `docker compose -f compose.yml -f compose.nginx.yml up -d app` → `curl -fsS http://127.0.0.1:3100/api/health`

## 6. Verify — do not skip this

`pg_restore` ignores errors by default and still exits 0, so a restore that
dropped an entire table looks exactly like one that worked. Always check the
row counts:

```sql
SELECT count(*) FROM post_locales;   -- the table that holds all post content
SELECT count(*) FROM posts;
```

Then `\dx` to confirm `vector` and `pg_trgm` are present, and load one post page
expecting a 200.

Any table restored with zero rows means the restore failed. Read the
`pg_restore` output rather than trusting its exit code.

> This is not hypothetical. Until migration `0007_restorable_tr_fold`, `tr_fold`
> called `tr_norm` without a schema qualifier. `pg_dump` emits
> `SET search_path = ''`, so recomputing the `post_locales` generated columns
> during a restore could not resolve `tr_norm`, the COPY for that table failed,
> and every dump restored with `post_locales` empty while reporting success.

## Rehearsal (quarterly)

Restore into a scratch database instead of the live one, compare counts, then
drop it:

```bash
docker compose -f compose.yml -f compose.nginx.yml exec -T db psql -U kb -d postgres \
  -c "CREATE DATABASE restoretest OWNER kb;"
docker compose -f compose.yml -f compose.nginx.yml exec -T db \
  pg_restore -U kb -d restoretest --no-owner < /tmp/db-YYYY-MM-DD.dump
docker compose -f compose.yml -f compose.nginx.yml exec -T db psql -U kb -d restoretest \
  -c "SELECT count(*) FROM post_locales;"
docker compose -f compose.yml -f compose.nginx.yml exec -T db psql -U kb -d postgres \
  -c "DROP DATABASE restoretest WITH (FORCE);"
```
