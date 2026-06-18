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
  marketing/    # Next.js — clankersupport.com landing
packages/
  db/           # Drizzle schema + client; emits SQL into apps/api/migrations
  shared/       # Zod schemas + shared types
  widget/       # Vite lib build → widget.js served by api
```

## Develop

```sh
pnpm install
cp apps/api/.env.example apps/api/.env   # fill in keys before running
pnpm dev                                 # = ploy dev — boots all apps
```

`ploy dev` at the repo root runs all projects together: api on `:8787`, dashboard on `:3001`, marketing on `:3002`, and the shared Ploy dashboard on `:9787`.

Migrations live at `apps/api/migrations/` (Ploy convention) and are applied automatically by `ploy dev`. To regenerate from the Drizzle schema:

```sh
pnpm migrations   # drizzle-kit generate (writes new SQL into apps/api/migrations)
```
