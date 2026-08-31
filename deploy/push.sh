#!/usr/bin/env bash
# Developer machine: sync source + compose files to the VPS and deploy.
#
# Usage: deploy/push.sh [user@host] [/remote/stack/dir]
#
# The target can also come from the environment (DEPLOY_HOST / DEPLOY_DIR) or
# from deploy/.target, an untracked file holding those two assignments — so the
# repository carries no particular server and you still type one short command:
#
#   printf 'DEPLOY_HOST=root@example.com\nDEPLOY_DIR=/opt/stacks/blog\n' > deploy/.target
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck source=/dev/null
[ -f deploy/.target ] && . deploy/.target

HOST="${1:-${DEPLOY_HOST:-}}"
DEST="${2:-${DEPLOY_DIR:-/opt/stacks/blog}}"
if [ -z "$HOST" ]; then
  echo "usage: deploy/push.sh user@host [/remote/stack/dir]" >&2
  echo "   or: set DEPLOY_HOST (and DEPLOY_DIR) in the environment or deploy/.target" >&2
  exit 1
fi

echo "==> deploying to $HOST:$DEST"
rsync -az --delete --exclude node_modules --exclude .next --exclude data --exclude .env --exclude '.env.*' --exclude .git --exclude docs --exclude tests --exclude secrets ./ "$HOST:$DEST/src/"
rsync -az compose.yml compose.nginx.yml deploy/deploy.sh deploy/backup.sh deploy/RESTORE.md "$HOST:$DEST/"
ssh "$HOST" "chmod +x $DEST/*.sh && cd $DEST && ./deploy.sh"
