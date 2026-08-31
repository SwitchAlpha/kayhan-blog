#!/usr/bin/env bash
# One-command local setup: writes .env with generated secrets, starts Postgres,
# applies migrations and creates the admin user.
#
# Usage:
#   scripts/setup.sh                      interactive (asks for the admin login)
#   scripts/setup.sh --yes                non-interactive; generates an admin password
#   scripts/setup.sh --name "My Blog" --author "Ada"
#   scripts/setup.sh --admin-email a@b.c --admin-password s3cret
#   scripts/setup.sh --skip-db            use an existing Postgres from .env
#
# Safe to re-run: an existing .env is never overwritten, and every step below is
# idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."

ASSUME_YES=0
SKIP_DB=0
ADMIN_EMAIL_ARG=""
ADMIN_PASSWORD_ARG=""
SITE_NAME_ARG=""
SITE_AUTHOR_ARG=""

while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes)          ASSUME_YES=1 ;;
    --skip-db)         SKIP_DB=1 ;;
    --admin-email)     ADMIN_EMAIL_ARG="${2:?--admin-email needs a value}"; shift ;;
    --admin-password)  ADMIN_PASSWORD_ARG="${2:?--admin-password needs a value}"; shift ;;
    --name)            SITE_NAME_ARG="${2:?--name needs a value}"; shift ;;
    --author)          SITE_AUTHOR_ARG="${2:?--author needs a value}"; shift ;;
    -h|--help)         sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1 (try --help)" >&2; exit 1 ;;
  esac
  shift
done

info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m warn\033[0m %s\n' "$1"; }
die()  { printf '\033[1;31merror\033[0m %s\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- prerequisites
info "checking prerequisites"

command -v node >/dev/null || die "node not found — install Node.js 20 or newer (https://nodejs.org)"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 20 ] || die "Node.js $NODE_MAJOR is too old — this project needs 20 or newer"

if ! command -v pnpm >/dev/null; then
  # corepack ships with Node and can provision the pinned pnpm from package.json.
  if command -v corepack >/dev/null; then
    info "pnpm not found — enabling it through corepack"
    corepack enable >/dev/null 2>&1 || die "corepack enable failed — install pnpm manually: npm i -g pnpm"
  else
    die "pnpm not found — install it with: npm i -g pnpm"
  fi
fi

command -v openssl >/dev/null || die "openssl not found — needed to generate secrets"

if [ "$SKIP_DB" -eq 0 ]; then
  command -v docker >/dev/null || die "docker not found — install Docker, or pass --skip-db to use your own Postgres"
  docker compose version >/dev/null 2>&1 || die "docker compose v2 not available — update Docker, or pass --skip-db"
  docker info >/dev/null 2>&1 || die "the Docker daemon is not running — start Docker Desktop (or dockerd) and re-run"
fi

# ------------------------------------------------------------------------- .env
# `sed -i` differs between GNU and BSD, so rewrite through a temp file instead.
set_env() {
  local key="$1" value="$2" tmp
  tmp=$(mktemp)
  if grep -qE "^${key}=" .env; then
    # Replace the value but keep any trailing `# comment` on the line.
    awk -v k="$key" -v v="$value" '
      $0 ~ "^" k "=" {
        comment = ""
        if (match($0, /[[:space:]]+#.*$/)) comment = substr($0, RSTART, RLENGTH)
        print k "=" v comment
        next
      }
      { print }
    ' .env > "$tmp"
  else
    cat .env > "$tmp"
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  mv "$tmp" .env
}

get_env() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- | sed 's/[[:space:]]*#.*$//'; }

if [ -f .env ]; then
  info ".env already exists — leaving it alone"
else
  [ -f .env.example ] || die ".env.example is missing; cannot generate .env"
  info "creating .env from .env.example with generated secrets"
  cp .env.example .env

  set_env BETTER_AUTH_SECRET "$(openssl rand -hex 32)"
  set_env INTERNAL_SECRET    "$(openssl rand -hex 32)"
  set_env INDEXNOW_KEY       "$(openssl rand -hex 16)"

  # Local defaults: the dev database from compose.dev.yml, and localhost origins.
  # With --skip-db the caller is bringing their own Postgres, so leave whatever
  # DATABASE_URL they set in the environment or in .env.example alone.
  if [ "$SKIP_DB" -eq 1 ]; then
    [ -n "${DATABASE_URL:-}" ] && set_env DATABASE_URL "$DATABASE_URL"
  else
    set_env DATABASE_URL "postgres://kb:kb@localhost:5432/${POSTGRES_DB:-blog}"
  fi
  set_env SITE_URL               "http://localhost:3000"
  set_env NEXT_PUBLIC_SITE_URL   "http://localhost:3000"
  set_env BETTER_AUTH_URL        "http://localhost:3000"
  set_env NEXT_PUBLIC_MEDIA_BASE ""

  # Identity. Asked first because it is the one answer nobody else can guess,
  # and a blog running under someone else's name is the thing people notice.
  site_name="$SITE_NAME_ARG"
  if [ -z "$site_name" ]; then
    if [ "$ASSUME_YES" -eq 1 ] || [ ! -t 0 ]; then
      site_name="My Blog"
    else
      printf 'blog name [My Blog]: '
      read -r site_name
      [ -n "$site_name" ] || site_name="My Blog"
    fi
  fi
  set_env SITE_NAME "$site_name"

  site_author="$SITE_AUTHOR_ARG"
  if [ -z "$site_author" ] && [ "$ASSUME_YES" -eq 0 ] && [ -t 0 ]; then
    printf 'author name (shown on posts) [%s]: ' "$site_name"
    read -r site_author
  fi
  # Empty is meaningful: config.ts falls back to SITE_NAME on its own.
  [ -n "$site_author" ] && set_env SITE_AUTHOR "$site_author"

  admin_email="$ADMIN_EMAIL_ARG"
  admin_password="$ADMIN_PASSWORD_ARG"

  if [ -z "$admin_email" ]; then
    if [ "$ASSUME_YES" -eq 1 ] || [ ! -t 0 ]; then
      admin_email="admin@example.com"
    else
      printf 'admin e-mail [admin@example.com]: '
      read -r admin_email
      [ -n "$admin_email" ] || admin_email="admin@example.com"
    fi
  fi

  if [ -z "$admin_password" ]; then
    if [ "$ASSUME_YES" -eq 1 ] || [ ! -t 0 ]; then
      admin_password="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
      GENERATED_PASSWORD="$admin_password"
    else
      printf 'admin password (blank = generate one): '
      read -rs admin_password; echo
      if [ -z "$admin_password" ]; then
        admin_password="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
        GENERATED_PASSWORD="$admin_password"
      fi
    fi
  fi

  set_env ADMIN_EMAIL            "$admin_email"
  set_env ADMIN_INITIAL_PASSWORD "$admin_password"
  chmod 600 .env
fi

# ----------------------------------------------------------------- dependencies
info "installing dependencies"
pnpm install --frozen-lockfile

# --------------------------------------------------------------------- database
if [ "$SKIP_DB" -eq 1 ]; then
  info "skipping the database container (--skip-db)"
else
  info "starting Postgres (pgvector/pgvector:pg17)"
  docker compose -f compose.dev.yml up -d db

  info "waiting for Postgres to accept connections"
  for i in $(seq 1 60); do
    if docker compose -f compose.dev.yml exec -T db pg_isready -U kb -d "${POSTGRES_DB:-blog}" >/dev/null 2>&1; then
      break
    fi
    [ "$i" -eq 60 ] && die "Postgres did not become ready; check: docker compose -f compose.dev.yml logs db"
    sleep 2
  done
fi

info "applying migrations"
pnpm db:migrate

# ------------------------------------------------------------------------ admin
# bootstrapAdmin also runs when the app boots, so a failure here is not fatal.
info "creating the admin user"
if pnpm seed:admin; then
  :
else
  warn "admin seeding failed — it will be retried automatically on first boot"
fi

# ------------------------------------------------------------------------- done
ADMIN_EMAIL_SET=$(get_env ADMIN_EMAIL)
cat <<EOF

  Setup complete.

    pnpm dev        start the site on http://localhost:3000
    pnpm test       run the test suite (needs the database up)

  Admin panel:  http://localhost:3000/admin/login
  E-mail:       ${ADMIN_EMAIL_SET}
EOF

if [ -n "${GENERATED_PASSWORD:-}" ]; then
  cat <<EOF
  Password:     ${GENERATED_PASSWORD}

  This password was generated and is stored in .env — change it after signing in.
EOF
else
  echo "  Password:     the one you entered (also in .env)"
fi

if [ -z "$(get_env OPENAI_API_KEY)" ]; then
  cat <<'EOF'

  OPENAI_API_KEY is empty, so the AI features (auto-linking, translation,
  categorisation, SEO assists) stay off. Add the key to .env to enable them;
  everything else works without it.
EOF
fi
