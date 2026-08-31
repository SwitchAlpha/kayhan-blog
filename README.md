# myblog

**An easy blog script.** Clone it, run one command, and you have a real blog —
bilingual, searchable, SEO-complete, with an admin panel — running on your own
server. No SaaS, no per-seat pricing, no vendor to outlive.

```bash
git clone https://github.com/SwitchAlpha/myblog.git && cd myblog
pnpm setup
pnpm dev
```

`pnpm setup` asks what your blog is called, generates every secret, starts
Postgres, applies migrations, creates your admin user, and prints the login.
It needs Node.js 20+, pnpm, and Docker, and it is safe to re-run.

Everything runs on one VPS: one Next.js container, one Postgres container.

## Why this one

Most self-hosted blog engines make you choose between "renders markdown" and
"has an actual editor". This one is the second thing, without dragging in a
plugin ecosystem — and it takes a few problems seriously that others skip.

**Search that works in Turkish.** Turkish breaks naive full-text search in ways
most engines never fix. Case folding is the famous one (`I` → `ı`, `İ` → `i`),
but diacritics matter just as much: someone typing `gozluk` expects to find
`gözlükler`. Normalisation happens inside Postgres through immutable `tr_norm` /
`tsv_fold` functions used in generated columns, with a trigram fallback for
near-misses, so ranking survives the folding instead of being bolted on after.
English works the way you would expect.

**Optional AI, on a leash.** Give it an OpenAI key and the editor will suggest
categories and tags (deduplicated against the taxonomy you already have), polish
a draft, and write SEO titles and descriptions that fit their length budgets.
Publishing a post embeds it with pgvector, proposes internal links in both
directions against your existing archive, and can queue a translation. Every
call is bounded by a daily call and dollar budget with a kill switch. Leave the
key empty and the whole subsystem stays off — the blog works normally.

**Built to be found.** Sitemaps, RSS, generated OG images, IndexNow pings, and
`llms.txt` / `llms-full.txt` plus per-post Markdown at `/llms/<locale>/<slug>.txt`,
so language models can read your writing as text instead of scraping HTML.

**An admin panel that isn't an afterthought.** Passkey (WebAuthn) sign-in
alongside password and 2FA, a Tiptap editor that compresses images on upload, a
job-queue dashboard, link review, and an audit log.

**Deploys that fail safely.** One command builds on the server, dumps the
database first, health-checks the new container, and rolls back to the previous
image if it does not come up.

## Stack

Next.js 16 (App Router, standalone output) · React 19 · TypeScript · Tailwind v4 ·
Drizzle ORM · Postgres 17 + pgvector · Better Auth · pg-boss · Tiptap 3 · OpenAI

Content is bilingual Turkish/English out of the box.

## Making it yours

Nothing about the blog's identity is compiled in. `pnpm setup` asks for the name;
everything is read at runtime, so renaming is an env change and a restart rather
than a rebuild.

| Variable | Purpose |
| --- | --- |
| `SITE_NAME` | What your blog calls itself — titles, feeds, PWA, authenticator entry |
| `SITE_AUTHOR` | Name on bylines and the footer; defaults to `SITE_NAME` |
| `SITE_WORDMARK` | Header wordmark; a dot is accented, as in `my.blog` |
| `SITE_TAGLINE_TR` / `_EN` | Home page heading; defaults to `SITE_NAME` |
| `SITE_DESCRIPTION_TR` / `_EN` | Home lede, feed description, llms.txt header |
| `SITE_URL`, `NEXT_PUBLIC_SITE_URL` | Public origin, used for canonicals and feeds |
| `DATABASE_URL` | Postgres connection string (needs the `vector` extension) |
| `OPENAI_API_KEY` | Empty turns every AI feature off |
| `AI_DAILY_MAX_CALLS`, `AI_DAILY_MAX_USD` | Hard spend ceiling; `AI_KILL_SWITCH=1` stops all calls |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | Empty means no ads and no consent banner |

`.env.example` documents the rest.

Non-interactive install, e.g. in CI:

```bash
pnpm setup --yes --name "My Blog" --author "Ada"
```

Already have a Postgres with the `vector` extension? Point `DATABASE_URL` at it
and pass `--skip-db`.

## Development

```bash
pnpm dev            # dev server on :3000
pnpm test           # vitest (the DB tests need Postgres up)
pnpm build          # production build
pnpm db:generate    # create a migration after editing src/lib/db/schema.ts
pnpm db:migrate     # apply pending migrations
```

Migrations also run when the app boots in production
(`src/instrumentation.ts`), so a broken migration fails the health check and
triggers a rollback instead of leaving a half-migrated database.

## Deployment

`deploy/SERVER-SETUP.md` walks through a single-VPS setup with Nginx on the host
terminating TLS: copy the compose files and `deploy.sh` to the server, fill in
`.env`, then run `deploy/push.sh user@host /opt/stacks/blog` from your machine.

`deploy/RESTORE.md` covers restoring from a backup — including why you must check
the row counts rather than trusting `pg_restore`'s exit code.

## Contributing

Issues and pull requests are welcome. `pnpm test` and `pnpm lint` should pass;
beyond that, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) — do what you like with the code.

Built for and running at [kayhan.blog](https://kayhan.blog), which is where any
rough edge gets found first. The posts and images published there are not part
of this repository.
