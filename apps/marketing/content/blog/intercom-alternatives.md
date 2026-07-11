---
title: "The best Intercom alternatives in 2026 (an honest comparison)"
description: "Ten Intercom alternatives compared by pricing model — per-seat, per-resolution, flat monthly, and self-hosted — with honest cons and when to stay put."
date: "2026-07-07"
category: "Guides"
featured: false
cover: "/blog/intercom-alternatives.jpg"
coverAlt: "The four support-software pricing models — per-seat, per-resolution, flat monthly, and self-hosted — as an annotated list in a dark code window on a violet gradient"
---

The best Intercom alternative depends on which pricing model you can live with: Zendesk or Freshdesk if you want a per-seat suite, Gorgias or Chatbase if usage-based billing fits your volume, Crisp or Clanker Support for flat monthly pricing, and Chatwoot if you want open source. Most teams leave over cost: seats from $29/month plus Fin's $0.99 per resolution.

That is the short answer. The longer one: "best" is meaningless until you decide how you want to pay for support software, because the pricing model — not the feature checklist — determines what your bill looks like at 10x your current volume. So this guide groups the alternatives by pricing model.

Two things up front. Disclosure: Clanker Support is our product; it sits in the flat-pricing section, is not ranked #1, and its weaknesses are listed as plainly as everyone else's. Methodology: this comparison is built from public pricing pages, docs, and each vendor's own claims, checked July 2026. Prices change — treat every number as "as of July 2026" and confirm on the vendor's pricing page.

## Why teams are leaving Intercom in 2026

Intercom renamed itself Fin in May 2026, after its AI agent, and on June 15, 2026 Salesforce signed a definitive agreement to acquire Fin for roughly $3.6 billion. The deal has not closed yet; an acquisition that size means roadmap and pricing uncertainty for at least a year.

But the acquisition mostly accelerated a migration already underway, and the reason is the bill. Intercom runs two meters at once:

- **Seats.** From $29 per seat per month on annual billing ($39 monthly), $85 ($99 monthly) for Advanced, $132 ($139 monthly) for Expert. Copilot, the AI assistant for your human agents, is another $29 per agent per month on annual billing.
- **Fin resolutions.** Fin, the AI agent, costs $0.99 per "outcome" — a resolution, a procedure handoff, or a disqualification — plus $9.99 per qualification, with a 50-outcome monthly minimum (roughly a $49 floor). The detail that surprises people: "assumed resolutions," where the customer simply stops replying and leaves, are billable. Asking for a human is free.

An illustrative worked example at those published rates: a five-person team on Advanced pays 5 × $85 = $425/month for seats, plus Copilot for everyone at 5 × $29 = $145. If Fin handles 600 billable outcomes that month, add $594. Total: about $1,164/month, roughly $14,000/year — and the Fin line grows with traffic, including conversations where the visitor just closed the tab. Full mechanics in [our Fin pricing teardown](/blog/intercom-fin-pricing).

None of this makes Intercom bad. It makes it expensive with an unpredictable AI line item, which is what sends people searching.

## How AI support pricing actually works in 2026

Every vendor's pricing page looks different, but there are only four underlying models.

- **Per-seat.** You pay per human agent per month (Zendesk, Freshdesk, Help Scout, Intercom's base plans). Predictable if headcount is stable — but in 2026 nearly every per-seat vendor has bolted a usage-priced AI meter on top, so you often pay both.
- **Per-resolution / usage-based.** You pay per AI resolution, ticket, conversation, or credit (Fin, Gorgias, Tidio's Lyro, Chatbase, Zendesk's AI agents). Cheap at low volume — but the bill scales with traffic, is hard to forecast, and the vendor decides what counts as "resolved."
- **Flat monthly.** A fixed subscription per workspace, regardless of seats (Crisp, Clanker Support). The number on the pricing page is the number on the invoice; tiers include a usage quota, so check your volume fits.
- **Self-hosted open source.** The software is free (Chatwoot, Clanker Support's open-source edition); you pay in infrastructure and your own time, plus LLM API costs if you run an AI agent.

The most common billing surprise in 2026 is the hybrid: per-seat base plan plus usage-priced AI add-on — two meters at once, the structure Intercom, Zendesk, Freshdesk, and Help Scout now share.

## Per-seat suites: the classic helpdesks

### Zendesk

The default enterprise answer, and genuinely the deepest omnichannel suite on this list.

- **Pricing:** Suite Team $55/agent/month, Suite Professional $115 on annual billing, as of July 2026; Copilot is a $50/agent/month add-on; AI agents bill separately per automated resolution, with no flat rate published on the pricing page
- **Pricing model:** per seat, plus per-resolution AI on top
- **Self-hostable:** no
- **Model choice:** no — Zendesk's own AI stack
- **Best for:** mid-size and large teams that need mature workflows, SLAs, a big marketplace, and every channel under one roof
- **Honest cons:** both meters — seats and resolutions; admin configuration is a real job; the entry price is nearly double Intercom's

### Freshdesk

The budget per-seat suite. Same shape as Zendesk, lower sticker price.

- **Pricing:** Growth $19/agent/month, Pro $55, Enterprise $89 on annual billing, as of July 2026, plus a limited free tier for 1–2 agents. The Freddy AI Agent includes 500 sessions on Pro and Enterprise, then $49 per 100 sessions; the Freddy Copilot add-on is priced separately.
- **Pricing model:** per seat, plus AI sessions on top
- **Self-hostable:** no
- **Model choice:** no
- **Best for:** teams that want a traditional ticketing suite at the lowest per-seat price, with room to grow into the wider Freshworks stack
- **Honest cons:** the interesting AI is gated to Pro and above; AI sessions are yet another meter; breadth over depth across the product

### Help Scout

The shared-inbox veteran, loved for being simple where the suites are heavy.

- **Pricing:** a free plan covers up to 5 users and 100 contacts/month; paid plans run Standard $25, Plus $45, and Pro $75 per user/month as of July 2026 (annual discounts apply). Its AI answers feature bills at $0.75 per resolution.
- **Pricing model:** per seat, with per-resolution AI on top
- **Self-hostable:** no
- **Model choice:** no
- **Best for:** small teams doing primarily email support who want a tool the whole team understands in an afternoon
- **Honest cons:** the AI is newer and shallower than the AI-first products here — and adopting it imports the same per-resolution unpredictability you were fleeing at Intercom

## Usage-based: pay per resolution, ticket, or conversation

### Fin standalone

The twist most listicles miss: you can keep Fin and drop Intercom. Fin works standalone on top of Zendesk or Salesforce, no Intercom seats required.

- **Pricing:** $0.99 per outcome (resolution, procedure handoff, or disqualification), $9.99 per qualification, 50-outcome monthly minimum — roughly a $49 floor — as of July 2026
- **Pricing model:** pure per-resolution
- **Self-hostable:** no
- **Model choice:** no — Fin runs on its proprietary Apex model
- **Best for:** teams already on Zendesk or Salesforce that want the highest-profile resolution engine without Intercom's suite
- **Honest cons:** assumed resolutions (the visitor leaves without replying) are billable; the bill scales with traffic; the pending Salesforce acquisition makes long-term pricing a guess

### Gorgias

The ecommerce specialist. Charges per ticket, not per agent — unlimited seats on every plan.

- **Pricing:** Starter $10/month for 50 tickets, Basic $50–60 for 300, Pro $300–360 for 2,000, Advanced $750–900 for 5,000 (lower figures are annual), as of July 2026. Its AI agent bills separately at $0.90–1.00 per automated interaction — and those interactions also count as tickets.
- **Pricing model:** per ticket, plus per-AI-interaction
- **Self-hostable:** no
- **Model choice:** no
- **Best for:** Shopify and ecommerce brands — the order-management integrations are the point
- **Honest cons:** built for ecommerce, awkward outside it; two usage meters at once; per-ticket pricing punishes high-volume, low-value contact patterns

### Tidio

SMB live chat with an AI agent (Lyro) bolted on as a metered add-on.

- **Pricing:** free plan with 50 conversations; Starter from about $24/month and Growth from about $49/month on annual billing; the Lyro AI add-on starts around $32.50/month for 50 AI conversations; Plus starts at $749/month, as of July 2026
- **Pricing model:** tiered conversation quotas, plus a separate AI-conversation quota
- **Self-hostable:** no
- **Model choice:** no
- **Best for:** small ecommerce and SMB sites that want chat plus basic automation running today
- **Honest cons:** multiple separately-billed quotas (conversations, Lyro conversations, automation triggers); the jump from Growth (~$49) to Plus ($749) strands scaling teams in between

### Chatbase

An AI-agent builder rather than a helpdesk: train an agent on your docs, deploy it across channels.

- **Pricing:** free plan (1 agent, basic models); paid plans from $40/month on a credit-based system, as of July 2026
- **Pricing model:** subscription tiers with usage credits
- **Self-hostable:** no
- **Model choice:** yes — you can pick between multiple LLMs
- **Best for:** getting a capable AI agent onto web, WhatsApp, Slack, and Messenger fast, with SOC 2 Type II compliance; it claims 10,000+ businesses
- **Honest cons:** an agent platform, not a support inbox — human handoff and team triage are thin compared to helpdesks; credits are one more meter to watch

We compare it to our own approach in [Clanker Support vs Chatbase](/vs/chatbase).

## Flat monthly pricing: predictable bills

### Crisp

The all-in-one European contender: chat, CRM, knowledge base, and campaigns in one box, priced per workspace instead of per seat.

- **Pricing:** a free 2-seat plan (no AI); AI-inclusive plans from roughly €45/month (Mini), with Essentials at €95 and Plus at €295 per workspace, as of July 2026
- **Pricing model:** flat monthly, per workspace
- **Self-hostable:** no
- **Model choice:** no
- **Best for:** SMBs that want chat, a lightweight CRM, and a knowledge base on one bill, with European hosting
- **Honest cons:** the AI is younger than the dedicated AI-first products; tier jumps are chunky; all-in-one breadth means some modules are shallow

### Clanker Support

Our product, so read this section knowing who wrote it. Clanker Support is an AI support agent installed with one script tag: it answers only from your knowledge base (page URLs, text snippets, Q&A pairs), cites its sources, and when it cannot help — or a visitor asks for a human — it hands off honestly: email and optional Slack notification, conversation landing in a team inbox, replies threading through email both ways. There is also a React Server Component SDK, a WordPress plugin, and a Shopify theme embed.

- **Pricing:** flat plans from $19/month (Starter), $89 (Growth), $299 (Scale); annual gives two months free; no per-seat fees, no per-resolution fees — each tier includes a monthly AI-response quota, detailed on the [pricing page](/pricing)
- **Pricing model:** flat monthly
- **Self-hostable:** yes — [open source](https://github.com/theopenco/llmchat), free to self-host with your own LLM Gateway key, running serverless on Cloudflare-compatible infrastructure with no Rails-and-Postgres stack to babysit
- **Model choice:** yes — pick the LLM per project (OpenAI, Anthropic, Google, and others) and swap it with a config change, no code change
- **Best for:** SaaS and developer-led teams that want a predictable bill, grounded answers with citations, and a clean human handoff
- **Honest cons:** web widget and email only — no WhatsApp, Messenger, Instagram, or voice; no CRM, product tours, or outbound campaigns; it is a newer product with a small ecosystem; and the hosted version has no free tier (self-hosting is the free path)

The [Intercom migration guide](/docs/migrate/intercom) covers the move step by step; the [live demo](https://showcase.clankersupport.com) runs the real widget, not a mockup; and [Clanker Support vs Intercom](/vs/intercom) has the feature-by-feature breakdown.

## Open source and self-hosted

### Chatwoot

The established open-source support platform, and the right default if omnichannel on your own infrastructure is the requirement.

- **Pricing:** the community edition is free to self-host; the paid cloud starts at $19/agent/month, as of July 2026
- **Pricing model:** free self-hosted, or per-seat cloud
- **Self-hostable:** yes — a Rails + PostgreSQL stack you operate yourself
- **Model choice:** not the core pitch — Chatwoot is inbox-first, not AI-first
- **Best for:** WhatsApp, Instagram, Telegram, and email in one self-hosted inbox with full data ownership; real momentum, with 34,000+ GitHub stars as of July 2026
- **Honest cons:** you are signing up to run and upgrade a Rails and Postgres deployment; AI capabilities are lighter than the AI-first agents here

Clanker Support also belongs in this category — same open-source, self-host-for-free deal, but AI-agent-first and serverless rather than inbox-first on Rails. Opposite trade-offs, unpacked in [Clanker Support vs Chatwoot](/vs/chatwoot) and our [open-source Intercom alternatives guide](/blog/open-source-intercom-alternatives).

## When to stay on Intercom

An honest comparison owes you this section. Intercom (now Fin) is still the right choice if:

- **You live on channels nobody here covers as well.** Fin runs across live chat, email, WhatsApp, SMS, phone, and Slack. If voice and WhatsApp are core channels, most alternatives on this list — ours included — do not compete.
- **Resolution economics favor you.** If Fin genuinely deflects a large share of your volume, $0.99 per resolution can beat the agents you would otherwise hire. Per-resolution pricing is bad when unpredictable, not when high-deflection and measured.
- **You use the whole platform.** Product tours, outbound messages, and campaigns are real products; replacing Intercom with three tools plus glue code changes the math.
- **Switching costs exceed the savings.** A large team with years of macros and reporting should price the migration honestly first.

If none of those describe you — mostly web and email support, modest or spiky volume, paying for seats and resolutions you barely use — that is exactly the profile that leaves.

## How to choose

- **1–5 people, early-stage SaaS:** minimize the floor and the variance. A flat plan (Clanker Support from $19/month, Crisp from ~€45) or a free tier (Chatbase, Tidio, Help Scout) gets you live without a usage meter to babysit.
- **Ecommerce:** Gorgias on Shopify for deep order integrations; Tidio for lighter chat automation.
- **10+ agents, many channels:** Zendesk or Freshdesk, eyes open about the AI add-on meters; consider Fin standalone on Zendesk if raw deflection is the goal.
- **Data ownership or compliance:** self-host — Chatwoot for omnichannel inbox depth, Clanker Support for an AI-first agent on serverless infrastructure.
- **You mainly want the AI to answer well and hand off cleanly:** compare the AI-first products directly in our [best AI support agents guide](/blog/best-ai-support-agents).

## FAQ

### Is there a free alternative to Intercom?

Yes, several. Crisp has a free 2-seat plan (without AI), Chatbase and Tidio have free tiers, and Help Scout's free plan covers up to 100 contacts a month. For a permanently free option with full features, self-host an open-source tool: Chatwoot's community edition or Clanker Support's open-source edition, where you bring your own LLM key.

### Why is Intercom so expensive?

Because two meters run at once. You pay per seat ($29–132 per agent per month on annual billing, as of July 2026), then Fin bills $0.99 for every resolution on top, with a 50-outcome monthly minimum. Copilot for human agents is another $29 per agent. Each line looks reasonable; the compounding is what shocks people at invoice time.

### What counts as a Fin resolution?

Fin bills $0.99 per "outcome": a resolution, a procedure handoff, or a disqualification, with qualifications billed at $9.99. Crucially, "assumed resolutions" — where the customer leaves without replying — are billable. You are not charged when a customer asks for a human. There is a 50-outcome monthly minimum, roughly a $49 floor, as of July 2026.

### What is the best open-source Intercom alternative?

Chatwoot is the established choice: an omnichannel inbox (WhatsApp, Instagram, Telegram, email) with 34,000+ GitHub stars, self-hosted on Rails and PostgreSQL. Clanker Support — our product — is the AI-agent-first alternative: serverless, model-agnostic, one-script install. Pick Chatwoot for channel breadth, Clanker Support if the AI agent and a predictable bill are the point.

### What is the best Intercom alternative for early-stage SaaS?

Prioritize a low, fixed floor over features you will not use yet. Flat-priced tools (Clanker Support from $19/month, Crisp from about €45/month as of July 2026) keep the bill predictable while volume is spiky. If WhatsApp or Instagram support is essential from day one, look at Chatwoot or Crisp instead — the AI-first agents, ours included, skip those channels.
