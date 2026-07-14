---
title: "Changelog: July 2026, so far — the platform month"
description: "Two weeks in and July is already our densest month: an approved WordPress plugin, a Shopify app, agents that take actions, dark mode everywhere, and a smarter, chattier widget."
date: "2026-07-14"
category: "Changelog"
featured: false
cover: "/blog/llmchat-changelog-july-2026.jpg"
coverAlt: "Dark illustration with the Clanker Support robot beside the words Changelog — July 2026, so far"
---

We usually write these when the month closes. July's first two weeks shipped more than most full months, so here's everything so far — with more to come before August.

**Clanker Support is an approved WordPress plugin.** The plugin went through WordPress.org review and is now [live in the plugin directory](https://wordpress.org/plugins/clanker-support/): install it, paste your project key under Settings → Clanker Support, and the widget is on every page — no code, and it survives theme changes. The [launch post](/blog/wordpress-ai-support-plugin) tells the whole story, including the zip file that was secretly a tar. A 1.0.1 followed within the week.

**A Shopify app, running end to end.** The Shopify app is built and deployed: a zero-permission theme app embed that puts the agent on your storefront without touching your orders, customers, or products. The App Store listing is in Shopify's hands; until it lands, the one-line script tag works on any store today — the [Shopify guide](https://docs.clankersupport.com/integrations/shopify) has both paths.

**The agent can now do things, not just say things.** Agent integrations shipped: the agent can look up a customer's order on Shopify or book a meeting through Cal.com, right inside the conversation, with a "Working on it…" indicator while an action runs. We hardened this layer before shipping it — SSRF guards, per-conversation action limits, and an audit log of every action the agent takes — and scoped the agent to support-only via a base system prompt, so it stays your support agent even when a visitor tries to make it something else.

**Dark mode, everywhere.** The widget now supports `data-theme="light" | "dark" | "auto" | "host"` — auto follows the visitor's OS, and host mirrors your site's own theme toggle live, so the widget flips the instant your page does. The dashboard got dark mode too, and inline embeds accept a theme parameter so a dark page never frames a white chat.

**The widget leads with chat.** Conversations now start in the chat itself — the contact form is opt-in per project, for teams that want a name and email up front. Alongside it: an expandable large panel, admin-defined starter question chips (with a live chat preview in the dashboard while you edit them), an end-of-conversation rating prompt, and a proper "start a new conversation" flow.

**Say "human" and it listens.** If a visitor explicitly asks for a person — "can I talk to a human", "agent please", "I don't want to talk to a bot" — the escalation button appears immediately, before the usual message threshold. The matcher errs toward showing the option: a false positive costs one extra button; a false negative traps a frustrated customer with a bot.

**Quote-reply in the chat.** Visitors can reply to a specific earlier message, so "what about this one?" stays unambiguous in long conversations — for the visitor, the agent, and your team reading the thread later.

**A notification bell in the dashboard.** New conversations, escalations, and new visitor messages across the whole workspace, in one feed — and clicking a notification opens that exact conversation, even if you're already in the inbox.

**An official React / Next.js package.** [`@clankersupport/widget-rsc`](https://www.npmjs.com/package/@clankersupport/widget-rsc) is on npm: one server component in your layout instead of a script tag. There's a [tutorial](/blog/nextjs-ai-support-widget-server-component) if you're on Next.js or any React 19 app.

**A real docs site.** Product docs now live at [docs.clankersupport.com](https://docs.clankersupport.com) — a getting-started path, a page per dashboard surface with real screenshots (light and dark), and integration guides for WordPress, Shopify, and the React SDK.

**Free tools.** An [AI support savings calculator, CSAT calculator, canned response generator, and llms.txt generator](/tools) — free, no signup, built because we kept needing them ourselves.

**Email that behaves.** Mail sent to your team address now forwards into the inbox reliably (and stops bouncing retries), and escalation replies keep threading straight back into the conversation.

That's two weeks. The Shopify listing decision, Slack notifications, and the public usage API are still in flight — see you at the end of the month.
