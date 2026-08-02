---
title: "We diffed our marketing site against our codebase. Six claims didn't survive"
description: "We put the homepage in one tab and the repo in the other and checked every falsifiable sentence against the code that would have to make it true. Six claims failed, one page undersold us, and an adversarial re-pass caught overclaims we wrote during the honesty pass itself. Every fix shipped in one public pull request."
seoDescription: "We diffed our marketing site against our codebase: six overclaims, one undersell, and a 5-step checklist for auditing your homepage against your repo."
date: "2026-07-26"
category: "Engineering"
featured: false
cover: "/blog/marketing-site-codebase-audit.jpg"
coverAlt: "Dark code window on a violet gradient showing the dashboard stat card that renders an em dash instead of a fabricated zero"
---

Last week we put our marketing site in one tab and our codebase in the other and checked every falsifiable sentence on the site against the code that would have to make it true. Six claims failed the check, and the people most likely to notice were exactly the people we most need to convince.

We build [Clanker Support](https://github.com/theopenco/llmchat), an open-source, MIT-licensed AI support agent you embed with one script tag. We're early: no wall of logos, no review-site score to lean on. The one trust asset available to a company like ours is honesty a stranger can verify, and claim drift burns it invisibly — usually midway through a technical evaluation, when a developer checks.

To be clear about how the drift accumulated: nobody sat down and decided to fabricate features. Copy got written against a roadmap, the code took a different route, and nobody ever diffs the homepage against the repo. Drift never feels like lying from the inside. The visitor reading the page can't tell the difference, so functionally it is.

Every fix below shipped as [one public pull request](https://github.com/theopenco/llmchat/pull/156). You can read each diff.

## The six claims that failed the diff

**1. "Run any model or provider."**

The model picker is a curated catalog of web-search-capable models, filtered from a generated snapshot of our gateway's catalog. Higher tiers unlock more of the list. "Any model" was aspirational copy for a picker that refuses to even boot with an empty list:

```ts
// packages/shared/src/models.ts
// Loud failure, never a blank picker: if the generated snapshot is ever empty
// (a botched regen), fail at import rather than silently offer no models.
if (WEB_SEARCH_MODELS.length === 0) {
	throw new Error(
		"WEB_SEARCH_MODELS is empty — run `pnpm gen:web-search-models` to regenerate from @llmgateway/models",
	);
}
```

A curated catalog is a defensible design choice. We rewrote the copy to describe it, because it's what you get.

**2. "How many exchanges before the bot hands off."**

That's how the site described the escalation threshold: as if the agent decides, at some configured point, to hand the conversation over. The setting behind that copy is a per-project message threshold, and what it does is reveal a "Talk to a human" button after N messages. The visitor decides. A counter, not a judgment. The copy now describes the threshold.

**3. "Answers when it can. Hands off when it can't."**

Tidy copy, and it claims the AI monitors its own confidence and bails out the moment it's unsure. Great feature. We don't have it. What actually exists is visitor-initiated hand-off: the threshold button above, plus pattern detection for a visitor explicitly asking for a person. The detector's own doc comment is more honest than our homepage was:

```ts
// packages/widget/src/escalation-intent.ts
/**
 * Detects a visitor explicitly asking for a human, so the "Talk to a human"
 * CTA can surface immediately instead of waiting for the message-count
 * threshold.
 *
 * Matching leans toward recall over precision: a match only REVEALS the
 * escalate button (the visitor still has to click it), so a rare false
 * positive costs one extra affordance while a false negative traps a
 * frustrated visitor with the bot.
 * …
 */
```

Even the explicit-ask path only reveals a button. The visitor clicks it. Nothing anywhere in the codebase asks the model how confident it feels. This one stung the most, because the fake version sounds smarter and we'd absorbed it into how we described the product out loud.

**4. Infrastructure attributed to the wrong vendor.**

Our comparison pages said "Fully self-hostable on Cloudflare infrastructure — D1, KV, and workerd." We don't run on Cloudflare. We run on serverless workerd via a platform called Ploy, and the same copy now reads "serverless workerd via Ploy (D1-compatible SQLite + KV state)." Same runtime family, wrong vendor. Nobody sues over this one, but a reader who catches the infrastructure paragraph being wrong has no reason to trust the security paragraph.

**5. "Self-host free, full feature set."**

The worst one, because it bent the promise open-source people actually check. Self-hosting is free forever with your own LLM keys; that part was true. What the copy skipped: a fresh self-hosted install resolves to a locked plan unless an environment allowlist is set. The unlock is a few lines of config parsing:

```ts
// apps/api/src/lib/plan.ts
export function internalEmails(env: Env): string[] {
	const raw = env.vars.INTERNAL_ACCOUNT_EMAILS;
	if (!raw) return [];
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}
```

Unset, no workspace is exempt, and software running on your own server greets you with a paywall you had no way to anticipate. The immediate fix was documentation: [the docs](https://docs.clankersupport.com) now tell you the unlock exists and how to set it, instead of letting you discover the lock the hard way. Documenting an awkward mechanism beats hiding it, and it bought us time to decide what the mechanism should become.

**6. SSO/SAML and audit logs listed on the enterprise tier.**

Display copy with zero code behind it. We don't mean "beta" or "partially built" — grep the repo for SAML and the only hits are the copy itself. Both are now labeled as roadmap. Had an enterprise buyer asked for an audit-log demo, the demo would have been us typing very fast in another room.

A seventh came from an internal doc rather than the site: a per-plan member cap we claimed to enforce. The entitlement number exists in the billing config, but there's no invite endpoint, so there's nothing to gate. A limit with no enforcement path is a wish with a number on it. Claim dropped.

## One page undersold us

The audit cut the other way exactly once. Our own Chatwoot comparison listed "fully open-source (MIT license) — read, fork, and contribute" as the competitor's advantage, implying we weren't. We are, and the LICENSE file has been in the repo the whole time. That fix went into the same pull request as the six above.

Finding it reframed the whole exercise. The target is agreement between the site and the repo, and undersell is the same defect as oversell: the two disagree. Treat both directions as bugs and the audit stops feeling like penance and starts feeling like ordinary QA, which is what got it finished.

## The re-pass found 18 more, four written during the fix

After the first fix pass we felt pretty good about ourselves. Then we ran an adversarial review: a two-agent panel, LLMs given the repo, whose only job was to attack the corrected copy against the codebase.

They found 14 missed instances of the same six overclaims, spread across pages, docs, and meta descriptions the first pass never opened.

Worse, they found 4 brand-new overclaims in the replacement copy itself. Text written during a truth-telling exercise, by people actively trying to be accurate, still drifted optimistic within the same edit session. We'd swap a false claim for a true one and unconsciously round it up while typing.

Marketing language has gravity: every sentence wants to be slightly more impressive than the facts, and you don't feel the pull while writing. The only countermeasure we've found is a second pass by someone, or something, that doesn't share your incentives.

## Diff your homepage against your repo

The repeatable version fits in an afternoon, and you don't have to read code to run it. Each step is an ask you can hand to your team as one sentence.

1. **Extract every falsifiable claim.** Scrape your homepage, pricing page, feature pages, and docs. Pull out every sentence that asserts something checkable: a feature exists, a limit is enforced, a platform is used, a license applies. Ignore vibes ("delightful"), keep facts ("supports SSO").

2. **Assign each claim a code location.** For every claim, ask: which file or endpoint makes this true? "Any model" should point at the model list. "Audit logs" should point at an audit-log table. A claim nobody can point anywhere is a finding, and whoever wrote the feature can answer the question in about a minute.

3. **Classify: true / roadmap / false / understated.** A roadmap item is fine as long as it's labeled as one. Anything shipped-but-unclaimed goes in the understated bucket, and it gets fixed in the same pass.

4. **Fix everything in one public pull request.** The public part is the point. A private cleanup earns nothing; a public one is evidence you can hand a skeptical visitor for years.

5. **Re-audit the fix adversarially.** This is the step everyone skips, and we nearly did. It produced 18 of our findings — four of which we authored during the fix itself. A colleague, an advisor, an LLM given the repo and told to attack: anyone whose job is to disagree with your copy.

Then put it on a calendar, because drift regrows and every new landing page restarts the clock. The cost of skipping the whole exercise never appears as a line item. It arrives as an evaluation that quietly churned when a developer caught claim number four, or an enterprise call where someone asks to see the audit log.

We've run a related exercise on our search presence before, in [our AI SEO audit checklist](/blog/ai-seo-audit-checklist). Don't blur the two: that one audits how your pages present claims to search and answer engines; this one audits the product claims themselves against code.

## The cheapest credibility available

The product carries the same rule at a smaller scale. Where the dashboard has no real value for a metric, it renders an em dash rather than a guessed number, and the inbox stats' doc comment spells the policy out:

```tsx
// apps/dashboard/src/app/inbox/_components/InboxStats.tsx
/**
 * …The avg rating is the mean CSAT across rated conversations only, shown
 * as "—" when none are rated (never NaN). While the aggregate is loading,
 * values render as "—".
 */
```

The usage meter in the sidebar goes further and renders nothing at all until the number resolves — its comment reads "(no fabricated zero)". That's the same rule our homepage broke six ways, applied at the level of a single stat card.

What a company at our stage can offer is verifiability: an MIT repo you can read, a public pull request where we corrected our own marketing, docs that explain the awkward parts like the self-host unlock instead of burying them. A skeptical developer can check every word of this post against the diffs in about ten minutes, and that checkability is worth more to us than any adjective we could have kept.

If you're early and your homepage promises things your repo can't cash, you're spending trust you haven't minted yet. Diff the site against the repo and fix in both directions, where people can watch. It's an afternoon of mildly humiliating work, and it's the cheapest credibility you'll ever buy.

## FAQ

### How do you audit marketing claims against a codebase?

Extract every falsifiable claim from your homepage, pricing page, and docs; assign each one the file or endpoint that would make it true; classify each as true, roadmap, false, or understated; fix everything in one public pull request; then have someone adversarial re-audit the fix. The last step matters most — our re-pass caught overclaims written during the fix itself.

### What is claim drift?

Claim drift is the gap that grows between what a marketing site says and what the codebase does. It rarely starts as a lie: copy gets written against a roadmap, the product takes a different route, and nobody re-checks the copy. The visitor can't distinguish drift from fabrication, so it costs the same trust.

### Should the fixes be public?

If the product is open source, yes. A private cleanup earns nothing, while a public pull request is standing evidence you can hand a skeptical evaluator years later. It also raises the cost of future drift, which is half the point.
