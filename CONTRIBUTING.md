# Contributing to myblog

Thanks for looking. Bug reports, questions and pull requests are all welcome.

## Getting set up

```bash
pnpm setup     # .env with generated secrets, Postgres, migrations, admin user
pnpm dev
```

`pnpm setup` is safe to re-run and will not overwrite an existing `.env`.

## Before opening a pull request

```bash
pnpm test        # vitest; the DB tests need Postgres running
pnpm lint
pnpm build
```

The database tests read `DATABASE_URL` from `.env`, so they run against the same
database as the app. `docker compose -f compose.dev.yml up -d db` starts it if it
is not already up.

## Things worth knowing

**Turkish text.** Never call `toLowerCase()` on raw Turkish text — it turns `İ`
into `i̇`. Use `src/lib/content/slug.ts` for slugs; search normalisation belongs
in Postgres (`tr_norm`, `tsv_fold`), not in JavaScript.

**Database functions.** Anything callable from a generated column must be
`IMMUTABLE`, and any user-defined function it calls must be schema-qualified.
`pg_dump` writes `SET search_path = ''`, so an unqualified call makes the dump
unrestorable — see `deploy/RESTORE.md` for the incident this rule comes from.

**Site identity.** Do not type a blog name, author or URL into a component. It
goes in `src/lib/site/config.ts` and comes from the environment at runtime.

**Anything statically prerendered** bakes build-time environment into the image,
where the runtime `.env` does not exist. If a route reads site config, it needs
`export const dynamic = "force-dynamic"`.

**Server actions and admin routes** start with `requireAdmin()` and validate
input with `zod`.

**AI calls** go through the budget in `src/lib/ai/client.ts`. Nothing should call
the provider directly.

## Migrations

Edit `src/lib/db/schema.ts`, then `pnpm db:generate`. For SQL that Drizzle cannot
derive — functions, extensions, generated columns — add the file by hand and a
matching entry in `drizzle/meta/_journal.json`, as `0007_restorable_tr_fold.sql`
does.

## Style

Commit messages and code comments in English. Match the surrounding code rather
than reformatting it; a comment should explain a constraint the code cannot show,
not narrate what the next line does.
