# Product Marketing Context

_Last updated: 2026-07-02 (auto-drafted from the codebase; review and correct)_

## Product Overview

**One-liner:** Clanker Support is an open-source AI customer support widget — streaming answers from your knowledge base, with human handoff when the AI isn't enough.
**What it does:** Site owners embed a chat widget (script tag, React Server Components package, or WordPress plugin). Visitors get streaming AI answers grounded in the project's knowledge base (docs URLs, snippets, Q&A pairs), can escalate to a human (email + Slack notifications), and operator replies from the dashboard inbox appear in the widget live.
**Product category:** AI customer support / support chat widget (searched as "AI support widget", "Intercom alternative", "AI chatbot for website").
**Product type:** SaaS with an open-source, self-hostable core ([theopenco/llmchat](https://github.com/theopenco/llmchat)).
**Business model:** Hosted plans (free plan shows "Powered by" branding; paid plans remove it and gate features server-side) + free self-hosting.

## Target Audience

**Target companies:** Small-to-mid SaaS teams, indie founders, docs-heavy products; increasingly non-developer site owners (WordPress, Shopify) as platform integrations ship.
**Decision-makers:** Founders, engineering leads, heads of support at small teams.
**Primary use case:** Deflect repetitive support questions with AI first response while keeping a trustworthy path to a human.
**Jobs to be done:**

- Answer visitor questions instantly from existing docs without staffing chat.
- Catch the conversations AI can't handle and route them to email/Slack.
- Own the stack (self-host) when compliance or cost demands it.

## Problems & Pain Points

**Core problem:** Support volume is dominated by questions the docs already answer; existing tools (Intercom, Fin) are expensive, closed, and heavy.
**Why alternatives fall short:** Per-resolution/per-seat pricing that scales badly; closed platforms; script-tag embeds that fight modern frameworks; AI-only tools with no human handoff story.
**What it costs them:** Hours of repetitive ticket triage; slow first response; lost conversions from unanswered pre-sales questions.

## Differentiation

**Key differentiators:**

- Open source and self-hostable — point any embed at your own deployment.
- Native platform integrations, not just a script tag: React Server Components package (`@clankersupport/widget-rsc`), WordPress plugin, script embed (Shopify planned).
- Human handoff done right: escalation state hydrates from the server, bot mutes while a human owns the thread, live operator replies via polling.
- Fail-soft engineering: a slow or down support API can never block or break the host page.
  **Why customers choose us:** Control (open source), price, and an embed that respects their stack.

## Customer Language

**Words to use:** "AI answers from your knowledge base", "talk to a human", "one component / one plugin / one script tag", "self-hostable", "open source", "no code" (WordPress audience).
**Words to avoid:** "revolutionary", "seamless", "leverage", "cutting-edge", exclamation points, fabricated metrics.

## Brand Voice

**Tone:** Professional but friendly; engineering-honest.
**Style:** Direct, specific, benefits-first with real technical detail as proof. Blog posts open with the reader's problem, not the product. First person plural ("we shipped").
**Personality:** Candid, technical, a little dry; confident without hype.

## Proof Points

- Widget script loads async and fails soft — never blocks the host page.
- RSC package: zero runtime dependencies, React 19 as the only peer.
- Same browser-storage keys across embeds — migrating between script tag / RSC / WordPress keeps existing visitor conversations.
- Open source repo: [theopenco/llmchat](https://github.com/theopenco/llmchat).

## Goals

**Business goal:** Grow installs across platform surfaces (npm package, WordPress plugin, script embed) and convert to hosted paid plans.
**Conversion action:** Create a project in the dashboard and embed the widget (grab the public key under Project → Embed).
