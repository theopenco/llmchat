---
title: "We set a cache trap for our own support agent — in our own llms.txt headers"
description: 'URL knowledge sources are snapshots, and everyone knows snapshots go stale. What we missed is that the refresh itself can be served by any CDN cache between the crawler and the origin — so "Recrawl → success" can silently re-store the pre-deploy content. The trap on our own site was set by our own cache headers.'
seoDescription: "A recrawl can be served by a CDN cache and silently re-store stale docs. How we cache-bust knowledge-base fetches: unique param, no-store, no-cache headers."
date: "2026-07-20"
category: "Engineering"
featured: false
cover: "/blog/knowledge-base-recrawl-cdn-cache.jpg"
coverAlt: "Dark code window on a violet gradient showing the fetchFresh cache-busting function from fetch-url.ts"
---

URL knowledge sources go stale in two layers: they are point-in-time snapshots, so deploying new docs changes nothing until someone recrawls — and the recrawl itself can be answered by a CDN cache sitting between the crawler and the origin, silently re-storing the pre-deploy content. Defeating that second layer takes a unique cache-busting query parameter, `cache: "no-store"`, and no-cache request headers, in that order.

The part that made us wince: the trap on our own site was set by our own hands. Our `llms.txt` — the plain-text index we publish so AI crawlers can read our content — is served with `cache-control: public, max-age=3600`. It is also a URL knowledge source for our own support agent. Click Recrawl within an hour of a deploy and the agent would have refreshed itself with the copy from before the deploy. PR #153 (commit `d905c42`, merged 2026-07-19) closes the hole; this post is the anatomy.

## The staleness layer we already documented

We wrote up layer one in [why our support agent doesn't use RAG](/blog/ai-support-agent-without-rag): a `url` source is fetched once, at creation, and stored as extracted text — at most 200 KB read, 20,000 characters kept, 10-second timeout (`MAX_BYTES`, `MAX_CHARS`, `TIMEOUT_MS` at the top of `apps/api/src/lib/fetch-url.ts`). Refresh is a manual Recrawl button in the dashboard. Deploying new docs does not update the agent until someone clicks it.

We then demonstrated the failure mode on ourselves. We shipped backend SDKs — the pip, gem, and Composer packages — asked our own widget about them, and it had no idea they existed. The diagnosis was boring: nobody had recrawled the source. Layer one, working exactly as (badly) designed — the button fixes it in one click.

But staring at what that button actually does — one plain `fetch` from a worker to a URL — surfaced the layer underneath. The click is not the whole path.

## Why a successful recrawl can still fetch stale content

A `fetch` from your crawler to an origin is not a private conversation. If the URL sits behind a CDN — and docs sites, marketing sites, and anything on modern hosting almost always do — the response can come from an edge cache that stored it earlier, and the cache will keep serving that copy until its `max-age` runs out. Deploying new content does not evict it on its own. Your crawler gets a 200, a plausible body, and no header that screams "this is from before your deploy."

Our refresh endpoint (`apps/api/src/routes/sources.ts`) then does the natural thing: stores the content and stamps `lastFetchedAt` with the current time. The dashboard's status chip reads Ready. Every signal an operator can see says fresh. The bytes are from an hour ago.

That is the expensive property of this bug: it is indistinguishable from success. A failed crawl shows an error and keeps the old snapshot. A cache-poisoned crawl shows the same Ready chip and keeps the old snapshot too — it just launders the timestamp.

## Our own llms.txt would have poisoned our own agent

The concrete instance lives in `apps/marketing/src/app/llms.txt/route.ts`:

```ts
// apps/marketing/src/app/llms.txt/route.ts
return new Response(body, {
	headers: {
		"content-type": "text/plain; charset=utf-8",
		"cache-control": "public, max-age=3600",
	},
});
```

That header is correct for its audience. `llms.txt` exists to be hammered by AI crawlers, and an hour of edge caching is basic politeness. But the same file does double duty as a knowledge source for our own agent, and for that consumer the header means: any recrawl within an hour of a deploy re-stores the pre-deploy index, reports success, and re-dates the snapshot.

Being exact about the blast radius: this is a _would have_, not a _did_. We found the hole while fixing the missing-recrawl problem above; we have no evidence a cache-poisoned recrawl ever fired, and no customer got a stale answer we can trace to it. It's a latent footgun we happened to catch while holding it. We wrote the cache header for crawlers in one app and the crawler it defeats in another, and neither file knew about the other until July.

## How to force a fresh fetch through CDN caches

The fix, `fetchFresh` in `apps/api/src/lib/fetch-url.ts`, layers three defenses, strongest first:

```ts
// apps/api/src/lib/fetch-url.ts
const u = new URL(url);
u.searchParams.set("__recrawl", crypto.randomUUID().slice(0, 8));
busted = u.toString();
// …
const res = await fetchBypassingCache(busted, signal);
if (res.ok) return res;
// …
return fetchBypassingCache(url, signal);
```

| Defense                                                        | What it does                                                                 | Why it isn't sufficient alone                                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Unique `__recrawl` query param per crawl                       | Changes the cache key, forcing a miss on any cache that keys on the full URL | Some origins reject unknown params (signed URLs); a CDN configured to strip query strings ignores it |
| `cache: "no-store"` on the fetch                               | Bypasses the requesting runtime's own HTTP cache                             | Governs only your side — no effect on CDNs in the path; older workerd throws on the option           |
| `cache-control: no-cache` + `pragma: no-cache` request headers | Asks shared caches to revalidate with the origin                             | The big CDNs don't honor request-side cache directives by default                                    |

The ordering is the lesson. The headers are what HTTP offers for exactly this situation, and they go last because in practice they do the least: Cloudflare and CloudFront, in their default configurations, ignore a client's `Cache-Control` request header entirely. The query param is a cruder tool — it doesn't ask the cache anything, it makes the cache's own key lookup miss — and that's precisely why it works everywhere caches key on the full URL, which is the default on every major CDN. Each crawl gets a fresh random value, because a stable buster would just get the busted URL cached instead. One of the five tests the fix added in `fetch-url.test.ts` pins exactly that: two crawls of the same URL must carry different `__recrawl` values.

## Why cache: no-store throws on older workerd

Defense two has a runtime problem we've met before. Our API runs on workerd, where [the platform's constraints are build-your-own-adventure](/blog/cloudflare-workers-every-node-sdk-broke), and `cache: "no-store"` is only accepted on compatibility dates from 2024-11-11 onward. Before that, the option doesn't get ignored — it throws:

```ts
// apps/api/src/lib/fetch-url.ts
try {
	return await fetch(url, { ...init, cache: "no-store" });
} catch (e) {
	if (
		e instanceof Error &&
		/the 'cache' field|unsupported cache mode/i.test(e.message)
	) {
		console.warn("[fetch-url] runtime rejected the cache option", {…});
		return fetch(url, init);
	}
	throw e;
}
```

The saving grace is that workerd rejects the option _before any network I/O_ — "The 'cache' field on 'RequestInitializerDict' is not implemented" — so falling back to a plain fetch can never duplicate an in-flight request. The fallback keeps the busted URL and the no-cache headers, dropping only the option the runtime refused. This matters mostly for self-hosters, who run whatever compatibility date their config pins.

The error match is deliberately narrow, and a test guards its edges with a hostile hostname: a DNS failure for `cdn.cachefly.net` contains the word "cache" but must not be misread as a compat rejection and swallowed into a retry.

## Don't let the cache-buster break a working source

An extra query param is not free. Signed URLs — S3 presigned links, anything with a `sig=` — can reject a request whose params don't match the signature. A cache-busting fix that turns a previously-working source into a 403 is a regression wearing a safety vest.

So `fetchFresh` retries: if the busted URL fails for any non-abort reason, it refetches the original URL untouched. That path can still be served stale by an edge cache — which is exactly as bad as before the fix, and no worse. And if even that fails, the refresh endpoint keeps the old snapshot and stamps `lastError` instead of blanking the content. The five tests pin the whole contract: a unique buster per crawl carrying the no-store option and both no-cache headers, the compat fallback, the original-URL retry for signed URLs, the narrow error match, and no retry after the 10-second timeout aborts.

## Your agent is only as fresh as the worst cache in the path

None of this is specific to our no-RAG design. Any knowledge pipeline that ingests over HTTP — full RAG with embeddings, prompt-stuffed snapshots like ours, a nightly scraper feeding a vector store — has its freshness bounded by every cache between the crawler and the truth. The embedding step can't vectorize content the CDN didn't hand over.

The transferable checklist, in the order that earns its keep: bust the cache key with a unique query param, because that defeats caches that ignore your headers; request `no-store` for your own runtime's cache, with a fallback if your runtime predates the option; send `cache-control: no-cache` anyway, for the caches that listen; and never let the buster regress a URL that worked without it. Then go audit your own properties for the recursive case — the content you publish _for_ AI consumers is the content most likely to sit behind a generous `max-age`, and it may well be feeding your own agent.

And treat every "last fetched" timestamp in your pipeline with appropriate suspicion. It dates the fetch. It says nothing about the bytes.
