---
title: "A 9-point AI SEO audit checklist, run on our own site first"
description: "Next.js merges route metadata shallowly, so every page built with our metadata helper — unless it passed a cover image of its own — shipped a Twitter card with no image for about a month. That was finding one of the SEO and AI-SEO audit we ran across our five domains this month, in two passes. Here is the whole audit as a checklist you can run on your own site, including the four findings that surprised us."
seoDescription: "A 9-point AI SEO audit checklist: the Next.js og:image shallow-merge bug, robots vs noindex, product-minted URLs, llms-full.txt, and AI crawler access."
date: "2026-07-20"
category: "Guides"
featured: false
cover: "/blog/ai-seo-audit-checklist.jpg"
coverAlt: "Dark code window on a violet gradient showing the DEFAULT_OG_IMAGE fix in seo.ts with its shallow-merge comment"
---

For about a month, every page on our marketing site that used our own metadata helper without an image of its own — `/pricing`, every `/vs/*` comparison, every `/features/*` page — shipped a `summary_large_image` Twitter card with no image. Not a broken image. No image at all, on pages whose metadata we thought a shared helper had made uniform. The cause is a Next.js behavior that hits any site combining a root Open Graph image with page-level metadata — which is most maturing Next.js sites — and we'll get to it first because it earned its place at the top of the checklist.

We found it while auditing our five web surfaces (marketing, docs, dashboard, showcase, admin). An AI-SEO audit checks the machine-facing surface of your site twice: once for search crawlers — robots rules, canonicals, sitemaps, Open Graph, structured data, index hygiene — and once for AI answer engines — crawler access for GPTBot, ClaudeBot and PerplexityBot, `llms.txt` and `llms-full.txt` files, and self-contained extractable answers. The output is a pass/fail list per domain you operate, including the domains your product mints pages on.

The audit landed in two waves: a first pass of fixes straight to main on July 6–8, then the cross-domain wave that merged as [PR #148](https://github.com/theopenco/llmchat/pull/148) on July 17 — that one touched marketing, docs, showcase, admin and the api. Everything is public in [the repo](https://github.com/theopenco/llmchat), so every finding links to real code. Here is the checklist, then the four findings that were genuinely non-obvious.

## The checklist

Run each question against every domain you operate — including subdomains you forgot you had.

| #   | Check                | Ask yourself                                                                                  | Us, before the audit                                                                       |
| --- | -------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Social card images   | Does the **rendered HTML** of every page contain `og:image` — not just the homepage?          | Fail — every helper-built page without its own cover had none                              |
| 2   | noindex reachability | Can crawlers fetch your noindex'd pages? A robots Disallow hides the tag                      | Fail — the dashboard got noindex + robots in wave one; admin's robots.txt came in wave two |
| 3   | Product-minted URLs  | Does every per-customer URL your product serves send noindex?                                 | Fail — `/embed/:key` was indexable                                                         |
| 4   | AI crawler access    | Do any robots rules block GPTBot, ClaudeBot, PerplexityBot, or Google-Extended?               | Pass — nothing blocked (now deliberate)                                                    |
| 5   | llms.txt files       | Do you publish a link map (`/llms.txt`) and a full-content file (`/llms-full.txt`)?           | Half — link map yes, full-content no                                                       |
| 6   | Secondary domains    | Does every subdomain have robots, a sitemap, canonicals, OG tags, and structured data?        | Fail — the docs subdomain had none of the five                                             |
| 7   | Title lengths        | Do your titles survive the ~60-character SERP cutoff?                                         | Fail — a brand suffix pushed every post past it                                            |
| 8   | Sitemap honesty      | Is `lastModified` a real content date or a build timestamp?                                   | Fail — build timestamp on every entry                                                      |
| 9   | Demo properties      | Do showcase/demo sites have a `metadataBase`, a canonical, and a robots.txt that isn't a 404? | Fail — our showcase's robots.txt returned 404                                              |

Five domains, nine checks, and the only things that came through clean were the marketing site's JSON-LD, canonicals and llms.txt — the parts built deliberately. Even its sitemap was lying about dates, and the RSS feed it should have advertised didn't exist until the first wave added it. Everything that grew organically had a gap.

## Why your Next.js pages have no og:image

The mechanism: Next.js merges route metadata **shallowly**. When a page exports its own `openGraph` object, it doesn't extend the layout's — it replaces it wholesale, and the same applies to `twitter` and `alternates`. Our root layout ships a site-wide OG cover via the `opengraph-image.png` file convention, and we assumed that cover reached every page. It reached exactly the pages that declared no `openGraph` of their own. Every page that called our `pageMeta` helper without an explicit image — `/pricing`, the comparisons, the feature pages, the tools — wiped the image out in the same stroke, and these were the pages we had put the most metadata care into. Blog posts survived only because they pass their own cover image to the same helper.

The failure is invisible in the browser and in most SEO tooling, because the pages still had titles, descriptions and canonicals. What they emitted was a `twitter:card` of `summary_large_image` with no image behind it, so every share of `/pricing` or a comparison page rendered as a bare text stub. We only caught it by grepping the prerendered HTML for `og:image` during the audit.

The fix is a constant and a default: put the image inside the helper, so no caller can forget it. The comment in `apps/marketing/src/lib/seo.ts` is the whole postmortem:

```ts
// apps/marketing/src/lib/seo.ts
/** The site-wide OG cover (the app/opengraph-image.png file convention route).
 * Explicit fallback because a page-level `openGraph` object replaces the
 * layout's resolved metadata wholesale (Next merges shallowly) — without this,
 * every pageMeta page shipped no og:image/twitter:image at all. */
const DEFAULT_OG_IMAGE = "/opengraph-image.png";
```

The same shallow merge had already bitten us once in the same file, back in the first wave — the `alternates` block re-declares the RSS `<link>` on every page, because a page-level canonical would otherwise delete the feed reference the layout set. Same behavior, different casualty.

Check number 1, generalized: if you use any metadata helper or page-level `openGraph` in a Next.js App Router site with a root OG image, view source on a non-homepage page and search for `og:image`. This combination — root image plus page-level metadata — is the default shape of a maturing Next.js site, which is why we're comfortable saying the bug is widespread. It costs you every social and chat-app share silently, and no console warns you.

## robots.txt Disallow doesn't deindex — it does the opposite

The counterintuitive one. Our operator dashboard should never appear in search results, and the reflex is to write `Disallow: /` in its robots.txt. That reflex is wrong, and it's wrong in a way that leaves the pages _in_ the index.

A robots Disallow controls **crawling**, not **indexing**. A `noindex` meta tag controls indexing — but Google can only read the tag on pages it's allowed to fetch. Disallow a URL that anyone links to externally, and Google indexes it anyway, as a bare URL with no snippet ("Indexed, though blocked by robots.txt" in Search Console). Our marketing site links to the dashboard sign-in page, so a Disallow would have pinned that URL in the index with no crawlable signal to ever remove it.

So the dashboard does the opposite. `apps/dashboard/src/app/robots.ts`, rationale included:

```ts
// apps/dashboard/src/app/robots.ts
// Deliberately allow crawling: the layout serves a noindex robots meta on every
// page, and Google can only see that tag on pages it's allowed to fetch. A
// Disallow here would leave externally-linked URLs (the marketing site links to
// sign-in) indexed as bare URLs with no way to discover the noindex.
export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", allow: "/" },
	};
}
```

This file is itself a first-wave audit fix (commit `90c3567`) — before it, the operator console had neither the meta tag nor the robots file. The internal admin console had carried a noindex meta since its first commit but no robots.txt at all, so the second wave gave it the same explicit file (commit `f8acf17`), mirroring the rationale.

Check number 2: for every property you want out of search results, confirm the noindex is _reachable_. Disallow plus noindex is not belt-and-suspenders — the belt hides the suspenders.

## Your product mints URLs on your domain — noindex them at the product level

This is the checklist item that only shows up when your product is itself a website. Clanker Support serves an iframe-able full-page chat shell at `/embed/:key` for hosts that can't run third-party script tags (the details are in [everything that broke while shipping an embeddable widget](/blog/shipping-an-embeddable-widget)). Every customer project gets one of these URLs — on **our** API domain.

Follow that to its bad ending: a customer embeds the iframe, their page links to our URL, a crawler finds it, and now a search for the customer's brand can surface `api.clankersupport.com/embed/<their-key>` — a bare chat shell wearing their brand color — next to, or instead of, the customer's own site. Nobody involved wants that, and the customer can't fix it, because the page isn't theirs.

Since the shell is served by a Hono route on workerd, not a Next.js page, the fix is a response header (commit `d276077`, in `apps/api/src/routes/embed.ts`):

```ts
// apps/api/src/routes/embed.ts
// Iframe chrome, not content: per-project embed URLs on the api host must
// never appear in search results next to the customer's own site.
c.header("x-robots-tag", "noindex");
```

Check number 3, and the framing we'd push hardest: for a SaaS, index hygiene is a **product decision**, not an SEO chore. Every URL pattern your product generates — embed shells, share links, preview pages, per-tenant subdomains — is a page you are publishing on your customers' behalf. Decide its index status when you design the feature, because by the time it ranks, it's an incident.

## What we ship for AI crawlers, and what we deliberately don't block

The AI half of the audit had two parts: what we add, and what we refuse to subtract.

What we added: `/llms-full.txt`, the [llmstxt.org](https://llmstxt.org) companion to the `/llms.txt` link map we already served. Where `llms.txt` is a table of contents, `llms-full.txt` is the entire text of every blog post in one plain-markdown file, newest first, so an AI system can ingest the content without crawling each page. The builder (`apps/marketing/src/lib/llms-full-txt.ts`) is 55 lines, pure, and unit-tested; the only subtle line rewrites root-relative links, because a markdown link like `/pricing` means nothing once the text leaves our domain:

```ts
// apps/marketing/src/lib/llms-full-txt.ts
// Root-relative markdown links would be resolved against whatever
// domain serves this text, so make them absolute site URLs.
const absolute = p.content.replace(/\]\((\/[^)\s]*)\)/g, `](${siteUrl}$1)`);
```

Honesty about what this buys: llms.txt is an emerging convention, and consumption by the major engines is unproven. Google has said plainly that AI Overviews need no special AI files — ordinary indexable HTML is the input — while other engines are less explicit, and some tooling does fetch these files today. We treat the pair as cheap insurance: one static route, a pure function, six unit tests, and content we'd publish anyway in a format that costs a crawler one request instead of twenty.

What we refused to subtract: the audit checked every robots surface on all five domains for AI-crawler blocks — GPTBot, ClaudeBot, PerplexityBot, Google-Extended — found none, and ratified that as policy rather than leaving it as an accident of defaults. Blocking AI crawlers is a defensible choice for a publisher whose content _is_ the product. Ours isn't; it's an open-source support agent, and the people who might use it increasingly ask an AI assistant what to use. An engine that has read our engineering posts can cite them; one that's blocked at robots.txt recommends whoever wasn't. The honest cost is that AI answers built on your content can substitute for visits to it. For a vendor blog, we'll take citation over control — being the source the answer names is the point of writing.

Check numbers 4 and 5: know your AI-crawler stance instead of inheriting it from a robots.txt someone wrote in 2019, and if you publish llms.txt files, hold them to the same testing standard as any route.

## The smaller line items

Four more findings, one paragraph each, because they'll each cost someone a quiet month.

**The docs subdomain had no baseline at all.** docs.clankersupport.com served no robots.txt, no sitemap, no canonicals, no OG or Twitter cards, and no structured data — the app was two weeks old and every one of those defaults to "missing" (commit `ac538e0` adds all five, plus `TechArticle` and `BreadcrumbList` JSON-LD on every page). Subdomains grow faster than their metadata; audit every host you answer on.

**A brand suffix ate every title.** Appending "— Clanker Support Journal" pushed every blog post title past the ~60-character SERP cutoff, so Google truncates or rewrites them (commit `b433b72` drops it, and adds a dedicated `seoDescription` field because our comparison tldrs and migration intros ran 260–380 characters against a 160-character meta limit). Measure the title as rendered, suffix included.

**Sitemap `lastModified` was a lie.** We stamped build time on every entry, which claims every page changed on every deploy. The comment in `seo.ts` now enforces the rule: only blog entries carry the field, from real publish/update dates, because a timestamp on everything "teaches crawlers to distrust the field."

**The showcase's robots.txt was a 404 page.** Our live-demo site returned HTML for `/robots.txt`, had no `metadataBase` (so its OG image resolved against nothing), and — a Next.js footnote worth knowing — an `opengraph-image` file alone emits only `og:image`; without explicit `openGraph`/`twitter` blocks there's no `og:title` or card type around it (commits `7ad1f32` and `5ad2bf7`, one from each wave).

## What we can't tell you yet

The cross-domain wave merged three days ago, and even the oldest first-wave fixes have had two weeks in production — not enough for Search Console to say anything. So we have zero results data: no ranking movement, no AI citations to report, no before/after chart. Anyone who ships SEO changes on Thursday and reports wins on Sunday is selling something. What we can vouch for today is the mechanism behind each fix: the shallow merge is documented Next.js behavior we verified in prerendered HTML, the Disallow-hides-noindex trap is how Google has worked for years, and the embed-shell noindex closes a real path to ranking against our own customers. We'll report back when Search Console has something worth quoting, including if the answer is "nothing moved."

If the llms.txt items made your own list, the [free llms.txt generator](/tools/llms-txt-generator) we host will build the link-map file from your page list — no sign-up attached. And if you run the nine checks and find your equivalent of the imageless Twitter card, we'd genuinely like to hear what it was: the whole audit started because we grepped our own HTML for a tag we were certain was there.
