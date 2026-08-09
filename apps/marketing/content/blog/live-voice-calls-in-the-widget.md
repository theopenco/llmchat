---
title: "Your support agent can talk now — live voice calls in the widget"
description: "On the Scale plan, the widget now offers real voice calls: the same agent, grounded in the same knowledge, speaking out loud — with the transcript saved to the conversation. Also new: Clanker Support is now listed on G2, Capterra, and AlternativeTo."
seoDescription: "Clanker Support now offers live AI voice calls in the widget on the Scale plan — plus new listings on G2, Capterra, and AlternativeTo."
date: "2026-08-09"
category: "Announcements"
featured: true
---

Two pieces of news this week, and one of them can literally speak for itself.

The big one: on the Scale plan, the widget can now take a **live voice call**. A visitor taps the handset icon in the widget header, and two seconds later they're talking — out loud, in real time — with the same support agent that answers the written chat. Same instructions, same knowledge base, same sources. The difference is that this time it has a voice.

The smaller one, which we'd argue matters just as much if you're deciding whether to trust us: Clanker Support is now listed on [G2](https://www.g2.com/products/clanker-support/reviews), [Capterra](https://www.capterra.com/search/?query=Clanker%20Support), and [AlternativeTo](https://alternativeto.net/software/clanker-support/). More on that below — including a small favor we'd like to ask.

## What a call is actually like

Some people don't want to type. They're driving, they're holding a toddler, they're on their third support tab of the day and the question is easier said than written. For them, the chat window now has a handset icon. Tapping it swaps the chat for a call screen: a pulsing orb in your brand color — slow pulse while it listens, fast while it speaks — a mute button, and a red hang-up button. That's the whole interface.

There's no push-to-talk and no awkward walkie-talkie rhythm. Turn-taking is automatic, and you can interrupt: talk over the agent mid-sentence and it stops immediately, the way a person would. It opens in the language your instructions are written in and switches if the visitor speaks something else. It keeps its answers to a sentence or two at a time, because nobody wants a voice that reads documentation aloud.

And because it's the same agent, the rules you already trust still hold. It answers from your knowledge, and when a caller asks for a person, it doesn't pretend to be one — it points them to the "Talk to a human" button in the chat, and the escalation flow you already know takes over.

## The call ends, the transcript stays

A voice channel that leaves no trace would be a support black hole, so we made the paper trail the default. When a call starts, a note lands in the conversation thread so your team knows it happened. When it ends, a full transcript — visitor and agent turns, in order — is saved into the same thread, right between the written messages. It shows up in your inbox like everything else: readable, searchable, part of the record when the conversation later escalates or moves to email.

Nobody on your team has to have been there. The call explains itself.

## Your audio never touches our servers

Here's the part we're most deliberate about. When a call starts, our API does exactly one thing: it checks the plan, assembles the agent's instructions, and issues a **short-lived call credential**. From there, audio streams directly between the visitor's browser and the realtime model provider. It never passes through our infrastructure. We can't hear it, we don't store it, and there is no recording — the transcript text is the only artifact, and it's saved into a conversation you already own.

The credential expires quickly, the model is locked the moment it's issued, and every call is capped in duration and spend. Calls are budgeted too — per visitor, per project, and per workspace, per day — so a scraper hammering the call button burns out against a rate limit, not your bill. If a visitor does hit a limit, the widget just falls back to written chat.

## The honest fine print

We put the trade-offs in the [docs](https://docs.clankersupport.com/learn/widget) rather than the footnotes, but here's the short version:

- **Voice condenses your knowledge.** Realtime voice models accept a much smaller instruction budget than written chat, so long knowledge bases get trimmed for calls. If voice matters to you, keep that project's prompt concise and put the essentials first. Written chat always uses the full budget.
- **Voice-enabled knowledge is visitor-visible.** Starting a call delivers the project's assembled instructions to the caller's browser to configure the session. Treat knowledge on a voice-enabled project as something a visitor could see — which, for support content, it should be anyway.
- **It's in-widget and inbound only.** No phone numbers, no outbound calls, no transferring a live call to a human. The escalation path is the same one chat uses.

## Voice is a Scale feature

Live voice calls are included on the [Scale plan](/pricing) — no per-minute pricing, no add-on SKU, no sales call to unlock it. Starter and Growth stay exactly as they are; voice is the thing that makes Scale feel like a different product rather than a bigger allowance. And like every hosted plan, Scale starts with a [7-day free trial](/blog/7-day-free-trial), so you can hear it with your own docs before paying anything.

## We're now on G2, Capterra, and AlternativeTo

Now the second announcement — the unglamorous one that took emails instead of engineering.

Clanker Support has official listings on [G2](https://www.g2.com/products/clanker-support/reviews), [Capterra](https://www.capterra.com/search/?query=Clanker%20Support), and [AlternativeTo](https://alternativeto.net/software/clanker-support/). If you've read this blog before, you know we care about being findable where people actually compare tools — we've written [comparison pages](/compare) that link to competitors' pricing and tell you when a rival is the better fit. Review platforms are the same idea with the roles reversed: strangers evaluating us, in public, with no edit access on our side. We think we do well under those conditions, which is why we showed up.

So here's the favor. If Clanker Support has answered a hard ticket for you, deflected a 2 a.m. question, or escalated gracefully instead of improvising a refund policy — a review on any of those platforms is the most useful thank-you there is. Five minutes of your time is worth more to a small open-source project than any ad budget we could spend. And if something's fallen short, say that too, there or [on GitHub](https://github.com/theopenco/llmchat) — public criticism we can fix beats private disappointment we never hear about.

## Try it

The written agent is one script tag and about five minutes — the [live demo](https://showcase.clankersupport.com) is the real widget if you want to see it before signing up. For voice, pick Scale on [/pricing](/pricing), point the agent at your docs, and tap the handset. The first time it answers a question about _your_ product, out loud, in your customer's language, is a genuinely strange and great moment. We'd love to hear what you ask it.
