# llmchat

AI-first support widget + admin inbox. Standalone product built on LLM Gateway.

## Stack

- **Runtime**: workerd via [Ploy](https://docs.meetploy.com)
- **Database**: D1-compatible SQLite (Ploy `db:` binding) with Drizzle ORM
- **Cache / rate-limit**: Ploy `state:` binding (KV-compatible)
- **Inference**: LLM Gateway (single backend, configured via `LLMGATEWAY_API_KEY`)
- **Email**: Resend REST API (outbound) + inbound webhook
- **Auth**: Better Auth (email + password)
- **Billing**: Stripe (metered AI messages + seat-based)

## Layout

```
apps/
  api/          # Hono — public chat (SSE), dashboard API, webhooks, serves widget.js
                #   migrations/ — D1 SQL migrations (Ploy applies these on dev/deploy)
  dashboard/    # Next.js — admin inbox + project settings
  marketing/    # Next.js — llmchat.io landing
packages/
  db/           # Drizzle schema + client; emits SQL into apps/api/migrations
  shared/       # Zod schemas + shared types
  widget/       # Vite lib build → widget.js served by api
```

## Develop

```sh
pnpm install
cp apps/api/.env.example apps/api/.env   # fill in keys before running

# Run the api (worker) via Ploy workspace mode:
pnpm dev                                 # = ploy dev — boots api on :8787

# Run a Next.js app (workspace mode skips them):
pnpm --filter @llmchat/dashboard dev     # next dev on :3001
pnpm --filter @llmchat/marketing dev     # next dev on :3002

# Or run a single project under Ploy directly:
cd apps/dashboard && pnpm exec ploy dev  # next dev + Ploy mock dashboard
```

`ploy dev` from the repo root uses workspace mode. Workspace mode currently runs **worker/dynamic projects only** — Next.js apps are skipped with a warning and need to be started separately. Defaults: api worker on `8787`, workspace Ploy dashboard on `9787`.

Migrations live at `apps/api/migrations/` (Ploy convention) and are applied automatically by `ploy dev`. To regenerate from the Drizzle schema:

```sh
pnpm migrations   # drizzle-kit generate (writes new SQL into apps/api/migrations)
```
