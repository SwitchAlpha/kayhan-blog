#!/usr/bin/env bash
# Build-on-server deploy. Usage (on the VPS, in the stack directory):  ./deploy.sh [tag]   |  ./deploy.sh rollback
# Source is synced to ./src by deploy/push.sh from the developer machine. Requires .env and secrets/pg_password.
set -euo pipefail
cd "$(dirname "$0")"
COMPOSE="docker compose -f compose.yml -f compose.nginx.yml"
TAG="${1:-$(date +%Y%m%d-%H%M%S)}"
# Read one key from .env without sourcing it (see the build step below for why).
env_get() { sed -n "s/^$1=//p" .env 2>/dev/null | head -1 | sed -e 's/[[:space:]]*#.*$//' -e 's/^"//' -e 's/"$//'; }
DB_NAME="$(env_get POSTGRES_DB)"; DB_NAME="${DB_NAME:-blog}"
IMAGE_NAME="$(env_get IMAGE_NAME)"; IMAGE_NAME="${IMAGE_NAME:-blog}"

if [ "$TAG" = "rollback" ]; then
  TAG=$(cat .deployed.prev 2>/dev/null || { echo "no previous tag"; exit 1; })
  echo "rolling back to $TAG"
else
  echo "==> building $IMAGE_NAME:$TAG"
  # No `. ./.env` here: Compose already reads .env from this directory to resolve
  # the ${...} build args, and it parses it as a dotenv file rather than as shell.
  # Sourcing it meant any value containing a space ran as a command —
  # a SITE_NAME with a space failed the deploy with "command not found",
  # and a value with backticks would have been executed outright.
  IMAGE_TAG="$TAG" $COMPOSE build app
fi
export IMAGE_TAG="$TAG"

echo "==> starting db"
$COMPOSE up -d db
until $COMPOSE exec -T db pg_isready -U kb -d "$DB_NAME" >/dev/null 2>&1; do sleep 2; done

if [ -n "$($COMPOSE ps -q app 2>/dev/null)" ]; then
  echo "==> pre-deploy database dump"
  mkdir -p backups
  $COMPOSE exec -T db pg_dump -U kb -Fc "$DB_NAME" > "backups/predeploy-$(date +%F-%H%M).dump" || echo "warning: predeploy dump failed"
  ls -t backups/predeploy-*.dump 2>/dev/null | tail -n +6 | xargs -r rm -f
fi

# migrations run inside the app on startup (src/instrumentation.ts); a failing migration fails the health check → rollback
echo "==> starting app $IMAGE_TAG"
[ -f .deployed ] && cp .deployed .deployed.prev
echo "$IMAGE_TAG" > .deployed
$COMPOSE up -d --remove-orphans app

echo "==> waiting for health"
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3100/api/health >/dev/null 2>&1; then echo "healthy"; docker image prune -f >/dev/null; exit 0; fi
  sleep 2
done
echo "app did not become healthy"; $COMPOSE logs --tail=60 app || true
if [ -f .deployed.prev ]; then echo "rolling back"; IMAGE_TAG=$(cat .deployed.prev) $COMPOSE up -d app; fi
exit 1
