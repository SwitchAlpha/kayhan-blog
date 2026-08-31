#!/usr/bin/env bash
# Nightly: pg_dump -Fc → R2 (daily/ + monthly/), uploads → R2, mark last_ok. Host cron: 17 3 * * * <stack>/backup.sh
set -euo pipefail
cd "$(dirname "$0")"
COMPOSE="docker compose -f compose.yml -f compose.nginx.yml"
R2_REMOTE="${R2_REMOTE:-r2:kb-backups}"
# Read one key from .env without sourcing it (see the build step below for why).
env_get() { sed -n "s/^$1=//p" .env 2>/dev/null | head -1 | sed -e 's/[[:space:]]*#.*$//' -e 's/^"//' -e 's/"$//'; }
DB_NAME="$(env_get POSTGRES_DB)"; DB_NAME="${DB_NAME:-blog}"
D=$(date +%F); TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
notify() { [ -n "${ALERT_WEBHOOK_URL:-}" ] && curl -fsS -m 10 -X POST -H 'Content-Type: text/plain' --data "$1" "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || true; }
fail() { echo "backup failed: $1"; notify "$DB_NAME backup FAILED: $1"; exit 1; }

$COMPOSE exec -T db pg_dump -U kb -Fc "$DB_NAME" > "$TMP/db-$D.dump" || fail "pg_dump"
[ -s "$TMP/db-$D.dump" ] || fail "empty dump"

# A dump that cannot be listed cannot be restored. This catches a truncated or
# corrupt archive here, rather than on the day it is actually needed. It does not
# prove the data restores cleanly — only the rehearsal in RESTORE.md does that.
# Runs in the container so the pg_restore version always matches the server's.
$COMPOSE exec -T db pg_restore --list > "$TMP/toc" < "$TMP/db-$D.dump" 2>/dev/null || fail "dump is not a readable archive"
grep -q 'TABLE DATA public post_locales' "$TMP/toc" || fail "dump has no post_locales data"

rclone copy "$TMP/db-$D.dump" "$R2_REMOTE/db/daily/" || fail "rclone db"
[ "$(date +%d)" = "01" ] && { rclone copy "$TMP/db-$D.dump" "$R2_REMOTE/db/monthly/" || fail "rclone monthly"; }
# Daily dumps are pruned after 30 days; the monthly copies are kept indefinitely.
rclone delete --min-age 30d "$R2_REMOTE/db/daily/" || echo "warning: daily retention prune failed"
# Ask the running app where /data/uploads actually lives, so this keeps working
# regardless of what the compose project or volume happens to be called.
APP_CID=$($COMPOSE ps -q app) || fail "app container not found"
[ -n "$APP_CID" ] || fail "app container not running"
UPLOADS=$(docker inspect "$APP_CID" -f '{{range .Mounts}}{{if eq .Destination "/data/uploads"}}{{.Source}}{{end}}{{end}}')
[ -n "$UPLOADS" ] || fail "could not locate the uploads volume"
# --max-delete is the guard that matters here: sync makes the destination match
# the source, so a volume that is momentarily empty or unmounted would otherwise
# wipe the off-site copy of every image. Better to abort and alert.
rclone sync "$UPLOADS" "$R2_REMOTE/media" --transfers 8 --max-delete 25 || fail "rclone media"
$COMPOSE exec -T db psql -U kb -d "$DB_NAME" -q -c "INSERT INTO settings(key,value,updated_at) VALUES('backup.last_ok', to_jsonb(now()), now()) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();" || true
echo "backup ok $D"
