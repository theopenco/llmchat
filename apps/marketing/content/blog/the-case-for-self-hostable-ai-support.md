---
title: "The case for self-hostable AI support"
description: "Why open architecture matters for tools that sit between you and your customers."
date: "2026-04-28"
category: "Engineering"
featured: false
---
Support tooling sits at a sensitive intersection: it handles customer PII, it's in the critical path of your customer relationships, and it's the first thing customers blame when something goes wrong. Locking that into a SaaS black box is a meaningful risk.

We built llmchat to be self-hostable from day one. Here's what that means in practice.

The stack is Ploy for deployment, D1 for the SQLite-compatible database, and KV for rate limiting and cache. All three run on Cloudflare's infrastructure. You can run the entire thing on your own Cloudflare account with your own domain, your own data residency, and your own billing.

The code is open architecture — meaning you can read it, audit it, and understand exactly what's happening with your customers' conversations. There are no hidden webhooks, no data sold to third parties, no opaque enrichment pipelines.

Self-hosting isn't for everyone. The managed version on llmchat.io handles infrastructure for you, and that's the right choice for most teams. But the option to take full control should exist, especially for regulated industries or companies with strict data handling requirements.

We think AI tools that handle sensitive customer interactions should be auditable by default. Self-hostability is one way to make that real.
