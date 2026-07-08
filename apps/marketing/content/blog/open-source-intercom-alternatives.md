---
title: "6 open-source Intercom alternatives you can self-host in 2026"
description: "Six open-source Intercom alternatives you can self-host, compared on license, stack weight, built-in AI, and model choice — checked July 2026."
date: "2026-07-07"
category: "Guides"
featured: false
---

The strongest open-source Intercom alternatives in 2026 are Chatwoot (the most complete omnichannel helpdesk), Zammad (process-heavy ticketing), FreeScout (lightweight shared inbox), Tiledesk (LLM agent flows), Papercups (maintenance mode), and Clanker Support (our AI-first agent: one script tag, any LLM, serverless self-hosting). The right pick depends on whether you need a helpdesk or an AI agent that answers and escalates.

That's the short version. The longer one matters, because these six tools share little beyond a public repo: some are full Rails platforms, some are single-purpose widgets, some haven't shipped in years — and only a couple can answer the question people actually ask in 2026: can it do what Fin does, without Fin's bill?

## Why developers are leaving Intercom

As of July 2026, Intercom starts at $29 per seat per month on annual billing ($39 if you pay monthly), and Fin — its AI agent — bills $0.99 per resolution on top. The definition of "resolution" is broad: it includes "assumed resolutions," where the customer simply leaves without replying. There's also a 50-outcome monthly minimum — a floor of roughly $50 a month (50 × $0.99 = $49.50, illustrative) before Fin has demonstrably resolved anything. The full math is in [our Fin pricing teardown](/blog/intercom-fin-pricing); check Intercom's pricing page for current numbers.

Cost isn't the only pressure. Intercom renamed itself Fin in May 2026, and on June 15, 2026 [Salesforce signed a definitive agreement to acquire Fin](https://www.salesforce.com/news/press-releases/2026/06/15/salesforce-signs-definitive-agreement-to-acquire-fin/) for roughly $3.6 billion (the deal hasn't closed). If part of your support stack's roadmap just became a Salesforce integration question, wanting an exit you control is rational.

And the structural issue: per-resolution pricing means your vendor profits from counting generously, and a closed product means you never choose which model answers your customers.

## What open source actually buys you

Three things, concretely:

- **A license nobody can re-price.** MIT or AGPL code can't be acquired out from under you, moved to per-resolution billing, or sunset by a new owner. Worst case, you pin a version or fork. Not a hypothetical benefit in the year your incumbent got acquired.
- **Your data, in your database.** Conversations, customer emails, and knowledge content sit in Postgres, MySQL, or SQLite that you control. Migrations become a schema problem, not an export-negotiation problem.
- **Your choice of LLM.** The axis almost nobody comparing these tools writes about. Closed AI support products bundle a proprietary model into an opaque per-resolution price. Open-source AI-era tools let you bring your own key — pick the model, swap when a better one ships, pay your provider per token, at cost.

What it does not buy you: someone else's pager. More on that below.

## The alternatives, compared

Method note: this comparison is built from each project's public repo, license file, docs, and pricing pages, checked in July 2026 — no synthetic benchmarks. Where a vendor's numbers appear, verify them on their pricing page before you budget.

### Chatwoot — the most complete open-source helpdesk

If you want the closest thing to a full Intercom replacement, it's Chatwoot — no contest. Live chat, shared email inbox, WhatsApp, Instagram, Telegram — a genuine omnichannel desk with 34,000+ GitHub stars and steady releases. Its AI agent, Captain, handles FAQ-style answers and agent assists — but as of July 2026 Captain is a credit-metered paid feature, not part of the free self-hosted community edition. If your reason for self-hosting is "free AI support," that combination doesn't exist here.

- **License:** MIT, with the `enterprise/` directory under a separate commercial license
- **Stack & self-host weight:** Ruby on Rails + Vue + PostgreSQL + Redis — a real platform to operate, not a widget
- **Built-in AI:** Captain (answers, summaries, agent copilot) — paid, credit-metered, not in the free community edition
- **Model choice:** Captain is Chatwoot's managed AI feature; you're not picking the model per project
- **Hosted option:** yes, cloud from $19 per agent/month as of July 2026
- **Best for:** teams that want a full omnichannel helpdesk and have the ops capacity to run a Rails stack

We compare directly in [Clanker Support vs Chatwoot](/vs/chatwoot) — and in plenty of scenarios, Chatwoot is the right call.

### Zammad — process-heavy ticketing done properly

Zammad is a mature helpdesk/ticketing system (5,700+ stars) with strong workflow, SLA, and audit features — the kind of tool an IT department or regulated support org loves. It is emphatically not an AI-first product.

- **License:** AGPL-3.0
- **Stack & self-host weight:** heavy — Rails plus PostgreSQL 13+, Redis 6+, a reverse proxy, and Elasticsearch (optional per the docs, but performance degrades significantly without it)
- **Built-in AI:** not the pitch — this is tickets, queues, and process
- **Model choice:** n/a
- **Hosted option:** yes, Zammad sells hosted plans; pricing on their site
- **Best for:** structured ticketing with SLAs, roles, and reporting — internal IT, agencies, regulated teams

### FreeScout — the lightweight shared inbox

FreeScout is the anti-platform: a free, self-hosted help desk and shared mailbox (closer to a Help Scout alternative than an Intercom one), 4,400+ stars, demonstrably alive — its latest release shipped in July 2026. The economics are honest: a free AGPL core plus optional paid modules (WhatsApp, Telegram, Slack, dozens more) sold as one-time lifetime licenses.

- **License:** AGPL-3.0
- **Stack & self-host weight:** light — a PHP (Laravel) app; by far the easiest classic helpdesk on this list to run
- **Built-in AI:** none in the core; AI isn't the project's focus
- **Model choice:** n/a
- **Hosted option:** no first-party cloud — self-hosting is the product
- **Best for:** small teams that want email-first support on minimal infrastructure for near-zero recurring cost

### Tiledesk — open-source LLM agent flows

Tiledesk started as an open-source live chat and has pivoted hard toward AI: the project now describes itself as an open-source alternative to Voiceflow for building LLM-powered agents with human-in-the-loop handoff. If you want to visually design conversation flows — automated answers here, human handoff there — this is the tool aimed at exactly that.

- **License:** MIT
- **Stack & self-host weight:** moderate-to-heavy — a Node.js microservices architecture deployed via Docker Compose or Kubernetes/Helm; more moving parts than a single app
- **Built-in AI:** yes — LLM-powered agent building is now the core product
- **Model choice:** built around LLM integrations; check their docs for the currently supported provider list
- **Hosted option:** yes, a managed cloud exists; pricing on their site
- **Best for:** teams that want to design multi-step agent workflows rather than install a ready-made support agent

### Papercups — check the pulse before you commit

Papercups earns its place here mostly as a caution. It's a pleasant, minimal open-source live chat (MIT, Elixir/Phoenix, 6,000+ stars) — but the repo states plainly that it's in maintenance mode: no major new features planned, pull requests and bug fixes still accepted. Chaskiq, another Intercom-style project common in these roundups, warrants similar care: its license is AGPL-3.0 with a Commons Clause attached (source-available, not OSI-approved open source) and development has slowed markedly — the most recent tagged release dates to late 2023.

- **License:** MIT (Papercups); AGPL-3.0 + Commons Clause (Chaskiq — not OSI open source)
- **Stack & self-host weight:** Elixir/Phoenix (Papercups); Rails + React + PostgreSQL + Redis (Chaskiq)
- **Built-in AI:** none — both predate the AI-agent era of support tooling
- **Model choice:** n/a
- **Hosted option:** don't count on one for either project
- **Best for:** teams with Elixir chops who want a small codebase to own and extend — eyes open

### Clanker Support — AI-first, one script tag, any model

Disclosure first: Clanker Support is our product — read this entry knowing who wrote it. It's placed last on purpose.

Clanker Support is not a helpdesk platform. It's an AI support agent you add with one `<script>` tag (shadow DOM, no style bleed) — plus a React Server Components SDK, a WordPress plugin, and a Shopify theme embed. It answers only from the knowledge you give it — page URLs, text snippets, Q&A pairs — and cites its sources. When it can't help, it says so visibly and escalates: email (and optionally Slack) to your team, and the conversation lands in a team inbox with AI-written summaries, tags, and search. Email replies thread back into the conversation in both directions, and a visitor who asks for a human always gets one — that request overrides the escalation threshold.

- **License:** MIT ([github.com/theopenco/llmchat](https://github.com/theopenco/llmchat))
- **Stack & self-host weight:** serverless — runs on Cloudflare-compatible infrastructure (workerd, D1, KV). No Rails, no Postgres, no Elasticsearch to babysit
- **Built-in AI:** the entire product — grounded answers with citations, honest escalation, per-message thumbs, and 1–5 CSAT
- **Model choice:** any model via LLM Gateway — OpenAI, Anthropic, Google, and others — set per project, swappable with a config change
- **Hosted option:** flat plans from $19/month (annual = two months free), no per-seat or per-resolution fees; each tier includes a monthly AI-response quota — details on [pricing](/pricing)
- **Best for:** developer-led teams that want an AI agent answering from their docs today, without adopting a platform

What we don't do, stated plainly: web widget and email only — no WhatsApp, Messenger, Instagram, or voice. No CRM, no product tours, no outbound campaigns. It's a newer product with a smaller ecosystem than Chatwoot's. And the hosted version has no free tier — self-hosting is the free path. If you need omnichannel, pick Chatwoot — we mean that. Poke the real widget on our [live demo](https://showcase.clankersupport.com) before forming an opinion.

## The honest cost of self-hosting

Every "open source is free" pitch skips this part.

Self-hosting Chatwoot or Zammad means operating a Rails application: a VPS, PostgreSQL, Redis, possibly Elasticsearch, plus backups, upgrades, security patches, and email deliverability (SPF, DKIM, bounces — the part everyone underestimates). None of it is hard; all of it is recurring. A few engineer-hours a month babysitting the stack usually costs more than a flat hosted plan — the line item just moves from "software" to "engineering time," where it's harder to see.

FreeScout sits at the cheap end of the trade: one PHP app. The serverless route — how Clanker Support is built — removes most of it: no server to patch, no database process to back up. You bring an LLM Gateway key, deploy, and your marginal cost is model tokens.

The honest framing: free license plus your ops time, or flat hosted fee plus someone else's. Pick deliberately.

## Is there an open-source alternative to Intercom Fin specifically?

Not a clone — and that's arguably the point. Fin bundles a proprietary model, a resolution-counting system, and a $0.99-per-outcome price into one product. As of July 2026 it charges for "assumed resolutions" (the customer left without replying) and carries the ~$50 monthly minimum — though it doesn't charge when the customer asks for a human.

The open-source answer decomposes the bundle instead of cloning it. On the AI axis there are three real options: Chatwoot's Captain (capable, but credit-metered and paid), Tiledesk's agent builder (if you want to design flows yourself), and Clanker Support (answers from your knowledge base with citations, escalates honestly, and lets you choose the model — paying your provider per token instead of per "resolution"). The economics differ in kind: token costs fall as models get cheaper; per-resolution fees scale with however your vendor defines success. Head-to-head details are in [Clanker Support vs Fin](/vs/fin) and [our guide to AI support agents](/blog/best-ai-support-agents).

## What a minimal self-hosted AI live chat setup looks like

Strip the category to parts and you need five things: a widget on your site, a place to put knowledge (docs URLs, snippets, Q&A), an inference path to some LLM, an escalation hatch to a human channel, and an inbox where a human triages what the AI couldn't handle.

The classic path: provision a VPS, run Docker Compose for a Rails or Node platform, configure Postgres and Redis, wire up SMTP, then bolt AI on top — often as a paid feature with its own configuration. Doable; plan a weekend plus ongoing care.

The serverless path, ours as the example: deploy the open-source repo to Cloudflare-compatible infrastructure, add your LLM Gateway key, paste one script tag before `</body>`, and point the knowledge base at your docs; escalation lands in email and Slack out of the box — the [self-hosting docs](https://docs.clankersupport.com) walk through it. Either way the parts list is the same; the difference is how much of it you maintain.

## Which one should you pick?

- **You want the full Intercom experience, open source:** Chatwoot. Most complete, most alive, biggest community. Budget for Rails ops, plus Captain credits if you want the AI.
- **You want structured ticketing with process and audit trails:** Zammad.
- **You want the cheapest sustainable email-first setup:** FreeScout.
- **You want to build custom LLM agent flows:** Tiledesk.
- **You want a minimal codebase to own and extend:** Papercups — clear-eyed about maintenance mode.
- **You want an AI agent grounded in your docs, on your choice of model:** Clanker Support — self-host free, or flat from $19/month hosted.

The case for staying put: if you depend on Intercom's omnichannel breadth, its outbound and product-tour tooling, or you're a Salesforce shop that stands to gain from the acquisition, Fin remains polished and migration has real switching costs. Leave because the pricing or lock-in bothers you — not because a blog post said so. The wider field, open source and not, is in our [Intercom alternatives roundup](/blog/intercom-alternatives).

## FAQ

### Is there a completely free open-source alternative to Intercom?

Yes, with a caveat. Chatwoot's community edition, FreeScout, and self-hosted Clanker Support all cost nothing in license fees. But "free" excludes your server and the AI: model usage needs an API key everywhere, and Chatwoot's Captain AI is a paid feature even self-hosted. Budget hosting plus per-token model costs — still typically far below per-seat-plus-per-resolution pricing.

### How hard is it to migrate off Intercom?

Easier than it looks. Export your conversation history from Intercom, rebuild your help content as knowledge sources in the new tool, swap the embed script, and run both widgets in parallel for a week while you compare answers. The knowledge rebuild is the real work; the widget swap is minutes. Our [Intercom migration guide](/docs/migrate/intercom) covers the steps.

### What does self-hosting a support tool actually cost?

The license is free; the total cost isn't. Count a server (or serverless infrastructure), an LLM API key if you want AI answers, and — the big one — engineer time for upgrades, backups, and email deliverability. A Rails platform needs far more care than a single PHP app or serverless worker. If upkeep eats hours monthly, flat hosted plans are often cheaper.

### Are open-source support tools sustainable long-term?

Judge each project, not the category. Look at release dates, commit activity, and how the maintainers earn money — Chatwoot, Zammad, and FreeScout all ship regularly and fund themselves through hosting, support, or paid modules. Papercups is in maintenance mode and Chaskiq has slowed. The floor is real, though: permissively licensed code can be forked and pinned, if you have the engineers.

### What's the closest open-source equivalent to Intercom Fin?

Nothing replicates Fin's bundled model and per-resolution billing — by design. Chatwoot's Captain is the closest inside a full helpdesk (paid, credit-based). Tiledesk is closest for custom agent building. Clanker Support is closest as a drop-in AI agent: grounded answers with citations, honest human escalation, your choice of LLM, and per-token economics instead of $0.99 per counted resolution.
