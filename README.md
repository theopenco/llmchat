# llmchat

AI-first support widget + admin inbox. Standalone product built on LLM Gateway.

## Stack

- **Runtime**: workerd via [Ploy](https://docs.meetploy.com)
- **Database**: D1 (SQLite) with Drizzle ORM
- **Cache / rate-limit**: KV
- **Inference**: LLM Gateway (single backend, configured via `LLMGATEWAY_API_KEY`)
- **Email**: Resend (outbound + inbound webhook)
- **Auth**: Better Auth
- **Billing**: Stripe (metered AI messages + seat-based)

## Layout

```
apps/
  api/          # Hono — public chat (SSE), dashboard API, webhooks, serves widget.js
  dashboard/    # Next.js — admin inbox + project settings
  marketing/    # Next.js — llmchat.io landing
packages/
  db/           # Drizzle schema, D1 client, migrations
  shared/       # Zod schemas + shared types
  ui/           # shadcn components shared dashboard ↔ widget source
  widget/       # Vite lib build → bundled widget.js served by api
```

## Develop

```sh
pnpm install
ploy dev          # boots api + dashboard + marketing with shared D1 + KV
```

Dashboard: http://localhost:8788
API: http://localhost:8787
Marketing: http://localhost:8789
Ploy console: http://localhost:9787
