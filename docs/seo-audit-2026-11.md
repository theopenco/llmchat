# SEO and AI-SEO audit — November 2026

Scope: `clankersupport.com` (marketing, 64 sitemap URLs) and `docs.clankersupport.com` (34 sitemap URLs). Method: crawl every sitemap URL, parse the served HTML (title, meta description, canonical, H1 count, JSON-LD types, image alt), follow every internal link, read `robots.txt` and response headers. Production was crawled on 2026-11-21 before the fix; the same crawler ran against local production builds after it.

## Results

| Check (98 pages)                        | Production (before) | This branch (after) |
| --------------------------------------- | ------------------- | ------------------- |
| `<title>` longer than 60 characters     | 16                  | 0                   |
| Meta description outside 100–160 chars  | 27                  | 0                   |
| Pages without JSON-LD                   | 2                   | 0                   |
| Duplicate titles                        | 2 pairs (docs)      | 0                   |
| Non-self canonical / H1 count ≠ 1       | 0                   | 0                   |
| Broken internal links                   | 0                   | 0                   |
| AI crawlers named in `robots.txt`       | no (only `*`)       | yes, both hosts     |
| `x-powered-by` / missing `nosniff`/HSTS | yes                 | removed / added     |

## Findings and fixes

### Technical

- **Security headers missing on the public sites** (medium). Marketing and docs sent `x-powered-by: Next.js` and no HSTS, `nosniff`, referrer or permissions policy. Fix: `poweredByHeader: false` on every Next app; the dashboard's header baseline (minus its CSP) on marketing and docs.
- **AI crawlers not named** (low, AI-SEO). `robots.txt` allowed everything through `*`, which works, but answer-engine crawlers were never stated. Fix: an explicit allow group for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Bingbot, DuckAssistBot, meta-externalagent and MistralAI-User on both hosts.

### On-page

- **16 blog titles truncated in SERPs** (high). Post headlines run 61–83 characters and were used as the `<title>` verbatim. Fix: an optional `seoTitle` (schema-capped at 60) in the posts collection, set on every long post; the page H1 keeps the full headline.
- **27 descriptions outside 100–160 characters** (medium). Seven marketing pages ran 164–189 characters (truncated); the rest, mostly docs pages plus a few early posts, ran 42–99 (weak SERP snippets). Fix: rewritten from each page's actual content.
- **Thin, generic feature-page titles** (medium). `/features/*` titles were the display name only ("Drop-in widget — Clanker Support", 32 chars) with no query terms. Fix: a keyword-first `seoTitle` per feature (for example "Embeddable AI Chat Widget, One Script Tag").
- **Duplicate docs titles** (medium). `features/escalation` vs `learn/escalation` and `features/knowledge-sources` vs `learn/sources` shared titles. Fix: the dashboard how-to pages are now "Handling escalations" and "Managing knowledge sources".
- **Thin hubs** (low). `/tools` (319 words) and `/features` (349 words) had no FAQ. Fix: four query-shaped FAQs each, rendered visibly and as `FAQPage`.

### Structured data and AI-SEO

- **No product entity on the home page** (medium). Home carried Organization, WebSite and FAQPage; the `SoftwareApplication` with prices only lived on `/pricing`. Fix: a `SoftwareApplication` node in the home `@graph` with an `AggregateOffer` priced from `BILLING_TIERS`.
- **Legal pages had no JSON-LD** (low). Fix: `BreadcrumbList` via the shared `LegalPage`.
- **Stale model claims** (medium, freshness). Copy said "GPT, Claude, Gemini and more", and the LLM Gateway post recommended Claude 3.5 Haiku and GPT-4o, both now retired. Fix: copy names the current generations; the post is refreshed with `updated: 2026-11-21` (drives `dateModified` and the new `article:modified_time`).
- **`llms.txt` didn't list models** (low). Agents answering "does Clanker Support run Claude Sonnet 5.5?" had nothing to cite. Fix: a generated `Models:` line with the full catalog, from the same snapshot the picker uses.

## After deploy

- Recrawl the `llms.txt` knowledge source in the dashboard (URL sources are stored snapshots).
- Resubmit both sitemaps in Search Console and Bing Webmaster Tools.
