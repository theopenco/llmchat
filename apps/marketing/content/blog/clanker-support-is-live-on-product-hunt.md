---
title: "Clanker Support is live — and we're on Product Hunt today"
description: "Clanker Support is officially live and featured on Product Hunt. Here's what we built: an AI support agent that answers from your docs and hands off to a human the moment it can't."
date: "2026-06-30"
category: "Announcements"
featured: true
---

Today Clanker Support leaves the workshop. It's officially live, it's open to everyone, and — as of this morning — it's featured on Product Hunt. If you've been waiting for a reason to give your support inbox a real upgrade, this is it.

We started Clanker Support with a complaint, not a pitch. Every "AI support" tool we tried had the same tell: faced with a question it couldn't answer, it made one up. Confident, fluent, and wrong. That's worse than no bot at all — a hallucinated refund policy costs you a customer and a chargeback.

So we built the opposite. Clanker Support answers from your docs, your help center, and the sources you give it — and the moment it can't answer for real, it escalates instead of guessing.

## One script tag, then it's working

Installation is one line of code before your closing `</body>` tag. No build step, no framework to fight. (_Update, July 2026:_ prefer a package? There's now an official React SDK — `@clankersupport/widget-rsc` on npm.) The widget mounts in an isolated shadow DOM, so it inherits your brand color without your styles leaking in or out. Most teams are live in about five minutes.

From there it reads from the knowledge you paste in and stays on topic. Ask it something off-script and it won't improvise — it raises its hand.

## The hand-off is the whole point

When the bot reaches the edge of what it knows — after however many exchanges you decide — it escalates. The full conversation lands in your team inbox with every message intact, an alert goes to your notification email, and the customer can keep the thread going over email. Nothing disappears into a black hole, and nobody has to re-explain their problem to a human who's seeing it cold.

That's the line we care about: an agent that's genuinely useful when it can be, and honest the second it can't.

## Built to stay out of your way

- **Any model.** Choose the model per project and swap it with a config change — no code edits — so routine questions run cheap and the hard ones run on something stronger.
- **Open and self-hostable.** Bring your own keys and run it on your own infrastructure for free. If you'd rather not operate it, the hosted version handles all of that for you.
- **Flat pricing.** Hosted plans start at $19 a month with no per-seat fees. Your bill doesn't grow every time you add a teammate.

## We're on Product Hunt today

This is the part where we ask for a hand. Clanker Support is featured on Product Hunt right now, and the first day is the one that counts. If support that escalates instead of hallucinating sounds like something you've wanted, an upvote or a comment genuinely moves the needle for us — and we'll be answering every question over there all day.

→ [See Clanker Support on Product Hunt](https://www.producthunt.com/products/clanker-support)

Or skip straight to the proof: drop the script tag on your site, paste in your docs, and watch the first conversation come through. We'd love to hear how it goes.
