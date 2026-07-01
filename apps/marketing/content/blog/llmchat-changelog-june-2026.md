---
title: "Changelog: June 2026 — launch month"
description: "We launched on Product Hunt. Also: smarter escalation, a full dashboard restyle, workspace-wide search, annual plans, and a security hardening pass."
date: "2026-07-01"
category: "Changelog"
featured: false
---

June was launch month. Here's everything that shipped.

**We're live — and we launched on Product Hunt.** Clanker Support is officially open to everyone, and we spent launch day on Product Hunt answering questions. If you missed it, the [launch announcement](/blog/clanker-support-is-live-on-product-hunt) covers what we built and why. To everyone who tried the widget, signed up, or asked us hard questions: thank you.

**Escalation got a lot smarter.** This was the month's biggest product theme. When a conversation escalates to your team, the agent now passes along an in-chat summary of what's been discussed, so the customer isn't asked to repeat themselves. The agent is identity-aware — it stops re-asking for a name and email it already has. And once a conversation is escalated, the bot stays quiet instead of talking over your team.

**Escalation emails the customer, and replies thread back.** When a conversation escalates, the customer gets an email — and their reply threads straight back into the same conversation in your inbox. No lost threads, even after they close the tab.

**Visitors can resolve their own conversations.** Customers can mark a conversation resolved from the widget, and the inbox now records who resolved each conversation — visitor, agent, or your team.

**The widget remembers returning visitors.** Visitor identity now persists across reloads, so returning customers skip the contact form and land back in their conversation. The greeting stays visible after the first message, and while a reply streams in, the latest turn stays pinned in view.

**Privacy controls per project.** You can set a privacy policy URL per project, and the widget shows a consent notice above the composer until the visitor sends their first message. Useful if you operate in regions where that's not optional.

**Dashboard restyle.** The whole dashboard got a design pass — inbox, projects, sources, settings, and billing — plus a new command bar shell. Same product, much easier on the eyes.

**⌘K search.** Workspace-wide global search with deep links into inbox conversations. This checks off the conversation search we promised in the May changelog.

**Inbox: AI triage summaries.** Every conversation in the inbox now shows a one-line AI summary, so you can scan a full queue without opening each thread.

**Typed knowledge sources.** Sources are now typed — add plain text or structured Q&A pairs directly from the dashboard, with per-type rollups so you can see what the bot is drawing from.

**Workspaces and annual plans.** You can create and delete workspaces, and the pricing page got a redesign: annual plans, an Enterprise tier, and richer quotas per plan.

**Security hardening pass.** We swept conversation access paths for authorization gaps, added signature verification on inbound email webhooks, and made auth rate-limiting durable. Not glamorous, but this is the layer everything else sits on.

Next up: Slack notifications and a public API for pulling usage data.
