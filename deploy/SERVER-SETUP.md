# Production server setup (Nginx variant)

One VPS running Docker, with Nginx on the host terminating TLS and proxying to the
app on `127.0.0.1:3100`. Postgres runs as a container and is never published.

Prerequisites: Docker 26+ with Compose v2, Nginx, certbot, and a free port for the
app (3100 below). If you put Cloudflare in front, also add a `set_real_ip_from`
config for the Cloudflare ranges so client IPs survive the proxy.

## 1. Stack directory

```bash
mkdir -p /opt/stacks/blog/secrets && cd /opt/stacks/blog
# copy from the repo: compose.yml compose.nginx.yml deploy/deploy.sh deploy/backup.sh
openssl rand -hex 24 > secrets/pg_password && chmod 600 secrets/pg_password
cp .env.example .env && chmod 600 .env
```

Fill in `.env`:

- `POSTGRES_DB` and `IMAGE_NAME` — any name you like; `DATABASE_URL=postgres://kb:<secrets/pg_password>@db:5432/<POSTGRES_DB>`
- `SITE_URL` / `NEXT_PUBLIC_SITE_URL` / `BETTER_AUTH_URL` — your public origin
- `SITE_NAME` (and optionally `SITE_AUTHOR`, `SITE_WORDMARK`, `SITE_TAGLINE_*`) — what the blog is called
- `BETTER_AUTH_SECRET`, `INTERNAL_SECRET` — `openssl rand -hex 32` each
- `INDEXNOW_KEY` — `openssl rand -hex 16`
- `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` — the admin is created on first boot
- `OPENAI_API_KEY` — optional; without it the AI features stay off
- `TZ` — e.g. `Europe/Istanbul`

## 2. Deploy

From the developer machine:

```bash
deploy/push.sh root@your-host /opt/stacks/blog
```

Source is rsynced to `<stack>/src`, `deploy.sh` builds the image on the server,
dumps the database, starts the app and polls `/api/health`. Migrations run inside
the app at startup (`src/instrumentation.ts`), so a failed migration fails the
health check and the deploy rolls back on its own. Manual rollback:
`./deploy.sh rollback`.

## 3. Nginx vhost + TLS

Use `deploy/nginx/site.conf.example` as the template (replace the domain), then:

```bash
certbot --nginx -d example.com -d www.example.com
```

Behind Cloudflare: SSL/TLS **Full (strict)**, Rocket Loader off, Bot Fight Mode off.

## 4. Backups

```bash
apt-get install -y rclone && rclone config    # remote name: r2
(crontab -l; echo "17 3 * * * cd /opt/stacks/blog && R2_REMOTE=r2:kb-backups ./backup.sh >> /var/log/blog-backup.log 2>&1") | crontab -
```

Restore procedure: `deploy/RESTORE.md`.
