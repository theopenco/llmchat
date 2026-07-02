---
title: "Add AI customer support to your WordPress site — no code required"
description: "Clanker Support is now a WordPress plugin. Install it, paste your project key, and every page gets an AI support agent with human handoff — no theme edits, no script snippets, no performance tax."
date: "2026-07-02"
category: "Announcements"
featured: false
cover: "/blog/wordpress-plugin-launch.jpg"
coverAlt: "WordPress admin showing the Clanker Support settings page with the chat widget open in the corner"
---

Adding a chat widget to WordPress has always meant one of two bad options: edit your theme and paste a script tag into `header.php` (which silently disappears the next time you switch or update themes), or install a generic "insert headers and footers" plugin and manage raw HTML in a settings box. Either way, you're maintaining code to use a product that was supposed to save you time.

We just shipped a third option. **Clanker Support is now a WordPress plugin.** Install it, paste your project key, save — and every page on your site gets a streaming AI support agent that answers from your knowledge base and hands off to a human when it should.

![The Clanker Support settings page in wp-admin: project key, floating widget toggle, brand color, escalation threshold, and API URL](/blog/wordpress-plugin-settings.jpg)

## Setup is one settings screen

Everything lives under **Settings → Clanker Support** in wp-admin:

- **Project key** — the public key from your dashboard (Project → Embed). It's the same key the script embed uses, so it's safe in your page HTML.
- **Floating widget** — the site-wide launcher bubble, on by default.
- **Brand color** — match the launcher and chat bubbles to your site.
- **Escalation threshold** — how many visitor messages before "Talk to a human" appears.
- **API URL** — for self-hosters (more on that below).

No template edits, no child theme, no code. If you can install a plugin, you can do this in under a minute.

## Why this beats pasting a script tag

The plugin is deliberately thin — under the hood it enqueues the same `widget.js` embed our dashboard generates — but moving it into a plugin changes what it's like to live with:

- **It survives your theme.** Script tags pasted into templates die on theme switches and updates. The plugin's settings live in your database and the widget is injected on every front-end page, whatever theme is active.
- **No performance tax.** The script loads asynchronously and renders after your page is interactive. The plugin adds no JavaScript or CSS of its own — one script tag on the front end is its entire footprint. And the widget fails soft: if our API is ever slow or unreachable, your pages render normally.
- **Always current.** The widget ships from the API, not from the plugin. New widget features appear on your site without a plugin update — the plugin itself should almost never need one.
- **Reconfigure without touching HTML.** Changing your brand color or escalation threshold is a settings save, not a snippet edit.

## What your visitors get

The same full support loop as every Clanker Support embed:

- Streaming AI answers grounded in your knowledge base — docs URLs, text snippets, Q&A pairs.
- Human escalation that notifies your team by email and Slack, with the bot going quiet while a human owns the conversation.
- Replies you send from the dashboard inbox appearing in the widget live, no refresh.
- Per-message thumbs ratings and an end-of-conversation CSAT prompt.

![How the WordPress plugin works: install and paste your key, the widget loads async from the Clanker API, visitors chat with AI answers and human handoff](/blog/wordpress-plugin-flow.jpg)

## Inline chat with a shortcode

The floating bubble isn't the only placement. Drop the shortcode into any page or post — a contact page, a help center, a pricing FAQ — and the chat renders inline:

```
[clanker_support width="400" height="600"]
```

The shortcode works even when the site-wide bubble is toggled off, so you can offer chat only where it makes sense.

## Self-hosting works here too

Clanker Support is open source ([theopenco/llmchat](https://github.com/theopenco/llmchat)), and the plugin treats self-hosters as first-class: point the API URL setting at your own deployment and everything — the widget script, the chat API, the inline embed — comes from your infrastructure instead of ours.

## Get the plugin

Grab the plugin from [GitHub](https://github.com/theopenco/llmchat/tree/main/packages/wordpress-plugin) and upload it under **Plugins → Add New → Upload Plugin**, then paste your project key from the dashboard. A WordPress.org directory listing is in the works, which will add one-click installs and automatic updates.

Next on the roadmap: automatically identifying logged-in WordPress users so escalations arrive with a name and email attached, and WooCommerce context so the agent knows about the visitor's order. If either of those matters to your store, come tell us in [Discord](https://discord.gg/RnyjHWuTKP) — it directly shapes what we build first.
