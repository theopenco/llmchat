---
title: "Intercom Fin pricing in 2026: the real math behind $0.99"
description: "A primary-source teardown of Intercom Fin's $0.99-per-resolution pricing: billable outcomes, assumed resolutions, seat costs, and the real monthly math."
date: "2026-07-07"
category: "Guides"
featured: false
cover: "/blog/intercom-fin-pricing.jpg"
coverAlt: "A worked example support bill — seats, Copilot, and Fin resolution fees totalling $1,164 a month — in a dark terminal window on a violet gradient"
---

Intercom Fin costs $0.99 per outcome — a resolution, a configured procedure handoff, or a lead disqualification — plus $9.99 per qualification, with a 50-outcome monthly minimum on non-Intercom helpdesks (about $49.50). Intercom seats stack on top, from $29 to $132 per seat per month on annual billing. Volume, not seats, drives the bill.

That is the one-paragraph answer. The rest of this post is the line-by-line version: what the fine print actually says, what stacks on top, and what two realistic teams would pay. Everything here was checked in July 2026 against the vendor pages and pricing calculator — [fin.ai/pricing](https://fin.ai/pricing), [intercom.com/pricing](https://www.intercom.com/pricing), and both companies' help centers — not against other vendors' blog posts, which is where most Fin pricing explainers get their numbers. Prices change; treat the vendor pages as the source of truth and this post as the map.

One disclosure up front: we build [Clanker Support](/pricing), a flat-priced, open-source AI support agent. We compete with Fin in one lane and not in several others, and we'll be explicit about which is which.

## Fin pricing at a glance

As of July 2026, per [fin.ai/pricing](https://fin.ai/pricing):

- **Per outcome: $0.99.** An outcome is a resolution, a procedure handoff (a workflow you configured to end with a human), or a disqualification (Fin decides a prospect doesn't meet your criteria).
- **Per qualification: $9.99.** When Fin matches a prospect to your qualification criteria and routes them, that single outcome costs ten times a resolution.
- **Monthly minimum: 50 outcomes** when running Fin on a non-Intercom helpdesk — roughly a $49.50 floor at $0.99 each. Intercom's own pricing page confirms a "minimum monthly commitment" applies to standalone Fin.
- **Human handoffs: free, mostly.** Per fin.ai/pricing: "You're not charged when a conversation is simply passed to your team without an outcome." The exception is a procedure you deliberately configured to end in a handoff — that is billable.
- **Billed once per conversation.** However many questions Fin answers in one thread, it charges at most one outcome for it.
- **No seat requirement for Fin itself.** Fin runs standalone on Zendesk, Salesforce, and other helpdesks without Intercom seats, with no setup or platform fees.
- **Intercom seats (if you use their helpdesk): Essential $29** per seat per month billed annually ($39 monthly), **Advanced $85** ($99 monthly), **Expert $132** ($139 monthly), as of July 2026. The pricing page now routes you through a calculator rather than a flat price list, so confirm against your own configuration on [Intercom's pricing page](https://www.intercom.com/pricing).

## What counts as a billable outcome — the fine print

The number that actually determines your bill is not $0.99. It is your **outcome rate**: what fraction of AI conversations end in a state Fin counts as billable. That definition lives in the help center, and it is worth quoting.

Per [Fin's pricing-outcomes article](https://fin.ai/help/en/articles/13975800-fin-pricing-outcomes), a resolution is counted when the customer either "confirms the answer was satisfactory (confirmed resolution), or exits the conversation without requesting further assistance (assumed resolution)." And the window: "If a customer disengages from the conversation for 24 hours after Fin's last answer, it is considered an assumed resolution."

Read that twice. **Silence is billable.** A customer who reads Fin's answer and closes the tab — satisfied, unsatisfied, or merely gone — counts as a resolution after 24 hours. This is the single most important line in Fin's pricing, and it is the one the $0.99 headline doesn't tell you. It is also the mechanic nearly every third-party Fin pricing explainer singles out, because it is the part customers say surprised them at invoice time.

In fairness, the fine print also contains genuinely pro-customer carve-outs, and most teardowns skip these too:

- **The clarifying-question exception.** If Fin's last message was a question rather than an answer and the customer never responds, "no resolution state is recorded and this is not a billable outcome."
- **The return deduction.** If a resolved conversation is reopened by the customer "even across billing periods, that resolution will be deducted and not charged."
- **Default escalations are free.** Handoffs triggered by Fin's default behavior or workspace rules aren't billed — only handoffs you explicitly built as procedures are.

So the honest summary: the definitions are reasonable and the carve-outs are real, but the assumed-resolution mechanic means your bill is decided partly by customer behavior you can't observe, using a counter you don't control.

## What stacks on top

Fin's per-outcome fee is the metered part. If your team also works inside Intercom's helpdesk, seats stack on top — as of July 2026, that's $29/$85/$132 per seat per month on annual billing (Essential/Advanced/Expert), or $39/$99/$139 monthly.

Then the add-ons, per [intercom.com/pricing](https://www.intercom.com/pricing):

- **Copilot** — the AI assistant for your human agents, distinct from Fin — is **$29 per agent per month billed annually** ($35 monthly) for unlimited usage, beyond a small free allowance of 10 Copilot conversations per agent per month.
- **Proactive Support Plus** is **$99/month** with 500 messages included.
- A **$99/month** conversation-analysis add-on includes 1,000 analyses monthly.
- Email campaigns, SMS, WhatsApp, and phone are **pay-as-you-go** on top.

None of these are hidden — they're on the pricing page. But "from $0.99 per resolution" and "what a 10-person support org pays Intercom per month" are very different numbers, which is why the next section does the arithmetic.

## The math: two illustrative teams

These are worked examples, not benchmarks — the assumptions are stated so you can rerun them with your own numbers. The key variable is the billable-outcome rate: the share of AI conversations that end in a confirmed resolution, an assumed resolution, or a configured handoff. We'll bracket it at 50–70%, on the assumption that the remainder escalate by default (free) or end on an unanswered clarifying question (free).

### A 2-person team at 300 AI conversations a month

- Outcomes: 150 to 210 conversations × $0.99 = **$148.50 to $207.90**
- Seats: 2 × $29 (Essential, annual) = **$58**
- Total: **$206.50 to $265.90 per month**
- With Copilot for both agents (2 × $29 = $58): **$264.50 to $323.90 per month**

Effective cost lands around $0.69 to $1.08 per AI-handled conversation once seats are included. At this scale Fin is not outrageous — the metered model is arguably at its best here, because a low-volume month produces a low bill (down to the ~$49.50 floor on standalone deployments).

### A 10-person team at 2,000 AI conversations a month

- Outcomes: 1,000 to 1,400 × $0.99 = **$990 to $1,386**
- Seats: 10 × $85 (Advanced, annual) = **$850**
- Copilot: 10 × $29 = **$290**
- Total: **$2,130 to $2,526 per month**, or roughly **$25,600 to $30,300 per year**

Note what happened between the two examples: conversation volume grew about 6.7×, and the bill grew roughly 8× to 10× depending on configuration. Metered pricing plus per-seat pricing compounds. And this is before pay-as-you-go channels or the $99 add-ons.

## Why the bill grows when the AI gets better

Per-outcome pricing has a clean sales pitch: you only pay when the AI succeeds. That alignment is real, and it deserves credit — a vendor that only earns on resolutions is motivated to resolve.

But follow the incentive one step further. Every improvement you make — a better knowledge base, tighter procedures, each model upgrade Fin ships — raises the resolution rate, and the resolution rate is the billing rate. The reward for doing support well is a larger invoice. Under a flat or quota model, deflection improvements accrue to you; under per-resolution pricing, they're split with the vendor, indefinitely.

The second-order problem is forecastability. Your bill is a function of ticket volume (seasonal, launch-driven, outage-driven) multiplied by an outcome rate that depends on Fin's own judgment calls and on the 24-hour silence rule. Finance teams can budget seats. Budgeting "how often will customers not reply to the bot" is harder. This isn't an accusation of bad faith — it is simply what the model does, and you should price it with your growth curve in mind, not your current one.

## The Salesforce acquisition: what it means if you're deciding now

The corporate facts, since most pricing explainers bury them: Intercom renamed itself Fin earlier in 2026, and on June 15, 2026, [Salesforce signed a definitive agreement to acquire Fin](https://www.salesforce.com/news/press-releases/2026/06/15/salesforce-signs-definitive-agreement-to-acquire-fin/) for approximately $3.6 billion, [confirmed on Intercom's own blog](https://www.intercom.com/blog/salesforce-signs-definitive-agreement-to-acquire-fin/). The deal is expected to close in the final quarter of Salesforce's fiscal 2027 — around the turn of the calendar year — pending regulatory clearance. Salesforce says Fin's team and technology will join Agentforce, its AI-agent platform. Fin's CEO and co-founder Eoghan McCabe said he will stay on and that, with Salesforce's resources, "little will practically change."

We won't speculate beyond that, and you should be wary of competitors who do. But if you are signing a contract today, three questions are legitimately on the table, acquisition or not:

- **Pricing continuity.** Nothing published promises today's $0.99 survives the integration; nothing says it won't. Ask for term protection in writing if it matters to you.
- **Roadmap gravity.** Post-close, Fin's roadmap presumably bends toward Agentforce and the Salesforce ecosystem. If you're a Salesforce shop, that may be good news. If you're not, ask where standalone deployments sit in the plan.
- **Contract length.** An annual commitment signed now matures inside someone else's integration timeline. Shorter terms buy optionality.

## Three ways to price an AI support agent

Most "Fin alternatives" posts pitch the same model at a lower unit price. The more useful comparison is between models, because the model determines how your costs behave as you grow.

- **Per resolution (Fin's model).** Lowest floor, aligned incentives, unbounded ceiling. Best when volume is low or spiky and you want to pay nothing for a quiet month. Worst when the AI works, because success is metered.
- **Cheaper per unit (credits and message packs).** Chatbase, for example, starts around $40/month on a credit system as of July 2026. The unit price is lower and the accounting simpler, but the shape is identical: costs scale with usage, and you're managing a credit balance instead of an outcome definition.
- **Flat subscription or self-hosted.** A fixed monthly price with a usage quota, or open-source software you run yourself. Predictable and immune to the deflection tax; the tradeoff is a real floor even in quiet months, and quotas you should read before buying. This is the lane [Chatwoot](/vs/chatwoot)'s self-hosted edition and our product occupy.

We compare the specific tools in more depth in our [Intercom alternatives](/blog/intercom-alternatives) and [open-source Intercom alternatives](/blog/open-source-intercom-alternatives) posts.

## The flat-price alternative (disclosure: ours)

Clanker Support is our product, so weight this section accordingly.

- **Pricing:** flat monthly plans from $19/month (Starter), with Growth at $89 and Scale at $299; annual billing gives two months free. Each tier includes a monthly AI-response quota — details on [/pricing](/pricing). No per-seat fees, no per-resolution fees. Your bill in a great month equals your bill in a quiet one.
- **Pricing model:** flat subscription, or free if you self-host — the code is [open source](https://github.com/theopenco/llmchat) and runs serverless on Cloudflare-compatible infrastructure with your own LLM Gateway key.
- **Setup:** one script tag before `</body>`, a React Server Components SDK, a WordPress plugin, or a Shopify theme embed.
- **How it answers:** only from the knowledge base you give it — page URLs, text snippets, Q&A pairs — with cited sources, and an honest, visible handoff to your team when it can't help. Asking for a human always overrides the AI.
- **Model choice:** pick the LLM per project (OpenAI, Anthropic, Google, and others) and swap it with a config change.

The honest tradeoffs: we are web widget and email only — no WhatsApp, Messenger, or voice. There's no CRM, no product tours, no outbound campaigns. We're a newer product with a smaller ecosystem, and the hosted version has no free tier (self-hosting is the free path). If those are dealbreakers, we're not your tool. If flat pricing and no metering are the point, the [Fin comparison](/vs/fin) and the [migration guide](/docs/migrate/fin) cover the details.

## When Fin is worth it

Genuinely, sometimes it is:

- **Low or spiky volume.** At a few hundred conversations a month, per-outcome pricing with a ~$49.50 floor can undercut any subscription, ours included.
- **Omnichannel requirements.** Fin operates across live chat, email, WhatsApp, SMS, phone, and Slack. If your support runs through channels beyond web and email, Fin does things we simply don't.
- **You already live in Zendesk or Salesforce.** Fin runs standalone on other helpdesks with no Intercom seats, and the Salesforce acquisition will likely deepen that side of the story.
- **Enterprise procurement.** A Salesforce-owned vendor with a mature compliance and integration ecosystem is an easier security-review conversation than a young open-source project.
- **You qualify for the startup program.** Intercom's pricing page advertises up to 93% off plus a year of Fin free for early-stage companies — at that discount, the math above changes completely.

If you're weighing the whole field rather than just Fin, start with the [full comparison](/compare) or the [Intercom comparison](/vs/intercom).

## FAQ

### How much does Intercom Fin cost per month?

Fin costs $0.99 per billable outcome, per fin.ai/pricing as of July 2026, with a 50-outcome monthly minimum (about $49.50) on non-Intercom helpdesks. Total monthly cost depends on conversation volume and your outcome rate: illustratively, a team handling 2,000 AI conversations could pay roughly $990–$1,386 for Fin alone, before Intercom seats and add-ons.

### What counts as a resolution with Fin?

Per Fin's help center, a resolution is counted when the customer confirms the answer helped, or exits without requesting further assistance — an "assumed resolution," triggered after 24 hours of silence following Fin's last answer. Procedure handoffs and disqualifications also bill at $0.99; qualifications bill at $9.99. Each conversation is charged at most once.

### Does Fin charge for human handoffs?

Mostly no. Per fin.ai/pricing, "you're not charged when a conversation is simply passed to your team without an outcome," and default escalations are free. The exception is a procedure you explicitly configured to end in a handoff — completing that workflow counts as a billable $0.99 outcome.

### Can I use Fin without Intercom?

Yes. As of July 2026, Fin runs standalone on Zendesk, Salesforce, and other helpdesks with no Intercom seat costs and no setup or platform fees, per fin.ai/pricing. The 50-outcome monthly minimum applies to these standalone deployments, so expect a floor of roughly $49.50 per month even at low volume.

### What does the Salesforce deal mean for Fin customers?

Salesforce signed a definitive agreement on June 15, 2026 to acquire Fin for about $3.6 billion, expected to close around the turn of the year (Salesforce's fiscal Q4 2027) pending regulatory approval. Salesforce plans to fold Fin into Agentforce, and Fin's CEO says he will stay on with little operational change near-term. Nothing published guarantees pricing continuity either way, so ask for terms in writing.
