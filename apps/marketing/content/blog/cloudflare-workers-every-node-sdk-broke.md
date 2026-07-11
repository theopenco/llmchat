---
title: "We moved our SaaS backend to workerd and every Node SDK broke"
description: "The Resend SDK, the Stripe Node SDK, and Better Auth's passkey plugin all got cut from our workerd build — each over something the package dragged in, not code we call. Here is each casualty, the fetch-and-crypto.subtle code that replaced it, and an honest accounting of whether it was worth it."
seoDescription: "What actually breaks when you move a Node backend to workerd: the deps we cut (Resend SDK, Stripe SDK, passkeys) and the fetch clients we wrote instead."
date: "2026-07-11"
category: "Engineering"
featured: false
cover: "/blog/cloudflare-workers-every-node-sdk-broke.jpg"
coverAlt: "A dark code editor window showing a hand-rolled Stripe fetch client for workerd, on a violet gradient background"
---

We ship Clanker Support's API to workerd — the open-source runtime underneath Cloudflare Workers — and three dependencies didn't survive the move: the Resend SDK, the Stripe Node SDK, and Better Auth's passkey plugin. None fell to code we call. Each fell to what the package dragged in — a webhook-crypto library, Node built-ins, an X.509 certificate parser. Each was replaced with plain `fetch` and `crypto.subtle`, and this post walks through the replacements.

Clanker Support is an open-source, self-hostable AI support widget ([theopenco/llmchat](https://github.com/theopenco/llmchat)), so every file mentioned below is public. The API is a [Hono](https://hono.dev) app that deploys to workerd via the [Ploy platform](https://docs.meetploy.com) — Ploy's bindings are D1-compatible SQLite and KV-compatible state, and the runtime constraints are the same ones you'd hit on Cloudflare Workers proper.

## Why we left Node in the first place

The short version: one JavaScript runtime everywhere, near-instant cold starts, and a deploy that either bundles or doesn't — no container image, no `node_modules` shipped to a server, no runtime surprise three requests in. Our repo's agent instructions state the constraint in one line:

> The api ships to workerd. Avoid Node-only deps — they fail to bundle.

That last clause is the interesting property. On workerd, an incompatible dependency is a **build-time** failure, not a 3 a.m. page. The bundler hits a Node built-in or a native addon it can't resolve, and the deploy dies right there. It's brutal, but it's brutal in CI instead of in production.

The cost of that property is the rest of this article.

## Why Node SDKs break on workerd

workerd implements the Web Platform: `fetch`, `Request`/`Response`, `crypto.subtle`, `TextEncoder`, streams. It does not give you Node's standard library, a filesystem, or long-lived module-scope state you can rely on across requests.

Most vendor SDKs were written for Node first. Even when the SDK's public API is portable, what sits underneath it usually isn't — and the whole tree is what the bundler has to swallow. Every casualty we hit followed the same shape: the top-level package looked innocent, and something it dragged in was not — sometimes a Node built-in one level down, sometimes an npm package three levels down.

The pattern held so consistently that we'd summarize the whole migration as: **audit your transitive dependencies, not your imports.**

## Breakage 1: the Resend SDK — a mail client that drags in webhook crypto

First casualty: the official `resend` npm package. We use Resend to send escalation emails — a visitor clicks "talk to a human", the operator gets an email, and replies thread back into the conversation (we wrote up that loop in [how we set up email threading](/blog/setting-up-email-threading)).

The SDK itself is a thin API client. But it pulled in `svix` — a webhook-verification library — as a dependency, and that was enough to make us drop it. Sending an email over Resend's API is one HTTP call, so the replacement in `lib/email.ts` is about as small as an integration gets: a raw `fetch` POST to `https://api.resend.com/emails` with a Bearer key and a JSON body. No client object, no retry machinery, no dependency tree.

Dropping the SDK also produced a nicer dev story: when `RESEND_API_KEY` is unset, `sendEmail` logs the message and returns `{ id: "dev-noop" }`, so local development and self-hosted installs need zero email setup.

One small detail we're fond of: the address validator deliberately rejects `$` anywhere in an email address. Not for RFC correctness — it catches unexpanded `$VAR` environment references before they end up in a Reply-To header, where Resend would reject the whole send with a 422. Cheap paranoia, one regex.

The webhook-verification side of Resend (inbound email replies are Svix-signed) got hand-rolled too — more on that below, because it pairs with Stripe.

## Breakage 2: the Stripe Node SDK — rewrite the form encoder and the webhook HMAC yourself

The big one. Stripe's Node SDK pulls in Node built-ins that don't bundle on workerd, so `apps/api/src/lib/stripe.ts` opens with what has become our team's unofficial manifesto:

```ts
// Stripe REST client for workerd. We deliberately do NOT use the Stripe Node
// SDK — it pulls Node built-ins that don't bundle on workerd, and the api is
// the one app that always deploys cleanly. Everything here is plain `fetch`
// with form-encoded bodies + Web Crypto signature verification.
```

The whole file is 289 lines and covers everything our metered billing needs: `createCustomer`, `createCheckoutSession`, `createPortalSession`, `retrieveSubscription`, `reportMeterEvent`, and webhook signature verification. Three parts were genuinely annoying to reimplement.

### Part one: Stripe's bracketed form encoding

Stripe's API doesn't take JSON. It takes form-encoded bodies with a bracket convention for nesting — `line_items[0][price]=price_123` — which the Node SDK normally hides from you. So the first thing we wrote was a recursive encoder:

```ts
export function formEncode(obj: Record<string, unknown>): string {
	const parts: string[] = [];
	const walk = (key: string, val: unknown) => {
		if (val === undefined || val === null) return;
		if (Array.isArray(val)) {
			val.forEach((v, i) => walk(`${key}[${i}]`, v));
		} else if (typeof val === "object") {
			for (const [k, v] of Object.entries(val)) walk(`${key}[${k}]`, v);
		} else {
			/* encodeURIComponent key=value */
		}
	};
```

Twenty-odd lines, but it encodes every request the billing system makes, including checkout sessions with nested line items. One Stripe-specific landmine it helped us respect: metered prices must **not** include a quantity on the line item — usage arrives later via meter events, and Stripe rejects the session otherwise. That rule now lives as a comment next to the code instead of somewhere inside an SDK.

### Part two: webhook verification without `constructEvent`

Stripe signs webhooks with a `stripe-signature` header shaped like `t=<unix>,v1=<hex>`: an HMAC-SHA256 over `${t}.${rawBody}`. The Node SDK's `stripe.webhooks.constructEvent` does this for you; on workerd you do it with `crypto.subtle` and you compare the result in constant time, because a naive `===` on secrets leaks timing information:

```ts
function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}
```

Our `verifyStripeSignature` also enforces a replay window: signatures older than 300 seconds are rejected, matching the default tolerance in [Stripe's own webhook docs](https://docs.stripe.com/webhooks).

Then Resend's Svix-signed inbound-email webhooks needed the _same idea with different details_, in `lib/svix.ts`: Svix signs `${id}.${timestamp}.${rawBody}` instead of `${t}.${body}`, uses a base64-decoded `whsec_`-prefixed key instead of a raw string, and emits base64 signatures in a space-separated `v1,<sig>` list instead of hex. Our Svix verifier also uses `Math.abs` on the timestamp delta, so it rejects future-dated signatures too — the Stripe one only checks age. Two webhook schemes, two hand-rolled verifiers, both `crypto.subtle` + constant-time compare, both fail-closed on a missing secret or malformed header.

Would we have gotten those cross-scheme details right without reading both vendors' verification docs line by line? No. That's the real cost of leaving the SDK behind: the vendor's docs become your spec, not their code.

### Part three: making best-effort metering safe

Billing is metered per AI response, and the meter report happens _after_ the response has streamed, inside `waitUntil` — best effort, never blocking the reply. Best effort plus retries usually equals double-billing, so every meter event carries an idempotency identifier: the database row id of the `usageEvent` we just inserted.

```ts
// the usageEvent id is the idempotency key so a retry can't double-bill
identifier: event?.id,
```

The row insert is the source of truth; the Stripe meter event is a projection of it. If the meter call fails, the row still exists and the retry carries the same identifier, so Stripe deduplicates it. We use Stripe's Billing Meters API, not the older subscription-item usage records it deprecated in 2024 — one nice thing about a hand-rolled client is that there's no SDK version pinning you to yesterday's endpoint.

## Breakage 3: passkeys — killed by an ASN.1 parser three levels down

The most instructive failure, because we never even called the offending code. We wanted passkey sign-in via `@better-auth/passkey`. That plugin depends on `@simplewebauthn/server`, which depends on `@peculiar/x509` and `asn1js` — X.509 certificate parsing for WebAuthn attestation. Somewhere down that chain the bundle broke.

To be precise about what happened, because it's easy to overclaim: Better Auth itself runs fine on workerd. Only the passkey **plugin** was removed, before launch, so no user ever lost a feature. The `passkey` table still sits in our Drizzle schema for the day the ecosystem catches up.

The lesson stands regardless: the dependency that kills your deploy is rarely the one in your `package.json`. It's the certificate parser your auth plugin's WebAuthn library needs for an attestation flow you might never have exercised.

## The quieter workerd-isms that bite without a bundler error

Bundle failures are loud. The subtler category is code that bundles fine and then behaves differently, because workerd's execution model isn't Node's.

### Env is a binding, so construct per request

On Node you read `process.env` at module scope and build your clients once. On workerd (under Ploy, and under Cloudflare Workers the same way), env arrives as a binding on each request. So the auth instance is constructed per request:

```ts
export function createAuth(env: Env) {
	return betterAuth(buildAuthOptions(env));
}
```

Every library that says "initialize the client once at startup" in its README is quietly assuming a runtime you no longer have. There is no startup.

### Module scope is per-isolate, so in-memory state is a mirage

Better Auth ships a built-in rate limiter that defaults to in-memory storage. On workerd that memory is per-isolate: your traffic fans out across many short-lived isolates, each with its own empty counter map, which makes an in-memory rate limiter effectively decorative. Not a bundling failure — the code runs — just a silently useless one, which is worse. We force the limiter on and back it with the KV-style state binding via Better Auth's `customStorage` hook, so the counters actually survive across isolates.

### No filesystem, so the widget ships as a string

The worker serves our embeddable widget at `/widget.js`. There's no filesystem to serve it from, so a post-build script embeds the compiled bundle into the worker as a generated TypeScript module:

```js
const bundle = await readFile(source, "utf8");
const banner =
	"// Generated by `pnpm --filter @llmchat/widget build`. Do not edit.\n// prettier-ignore\n";
await writeFile(
	target,
	`${banner}export const widgetBundle: string = ${JSON.stringify(bundle)};\n`,
);
```

Yes: our production widget is a `JSON.stringify`'d string constant, served with `cache-control: public, max-age=300`. It sounds like a hack until you notice what it buys — the asset is versioned atomically with the API that serves it, and there's no runtime read that can fail.

### KV isn't atomic, so decide your failure direction on purpose

Our rate limiter is a fixed-window counter doing a read-modify-write on the state binding, and the code says exactly what that means:

```ts
// Atomicity: this is a read-modify-write, so heavy concurrency on one key can
// overshoot `max` (a lost update undercounts the window).
```

We looked at building an atomic increment path and rejected it as fragile. Instead, every limiter-shaped thing in the codebase declares which way it fails when the state store is unavailable, and the answers differ on purpose:

- **`rateLimit` on public widget endpoints — fails open.** Defense-in-depth limiting must not take every customer's embed down with the store.
- **`reserveOnce`, the idempotency reservation — fails closed.** On a money-touching write path, a possible duplicate gets blocked, not waved through.
- **`shouldSendHolding`, the escalation-ack throttle — fails open toward sending.** A duplicate "we got your message" email beats a silent void.
- **The subscription check gating account deletion — fails closed.** If we can't verify there's no live subscription, the deletion waits.

None of this is workerd-specific wisdom, exactly. But losing the comfort of a Node process forced us to write each decision down, and the codebase is better for it.

## What didn't break

Honesty requires the counterweight: most of the stack was fine. Hono runs natively on workerd. Drizzle talks to the D1-compatible SQLite binding without complaint. Zod is pure JS. Better Auth core works. The Vercel AI SDK v6 plus `@llmgateway/ai-sdk-provider` — the pipeline behind every AI response — bundles cleanly (we've written about [why we built on LLM Gateway](/blog/why-we-built-on-llm-gateway)). We keep a contingency note to swap the provider for a direct `fetch` if a future version ever pulls Node deps, but it hasn't happened.

The story is not "nothing works on workerd". It's that the failures concentrate in vendor SDKs with deep dependency trees, and you can't predict them by reading your own import statements.

## Was it worth it?

What we got:

- **Deploys that can't half-work.** If it bundles, it runs. The API is the one app in our monorepo that always deploys cleanly, and that's not luck — the runtime rejects the entire class of "works on my machine, dies on the server" dependency problems at build time.
- **A dramatically smaller dependency surface.** The Stripe integration went from an SDK and its tree to 289 lines we can read in one sitting. Every HTTP call our billing system makes is visible in one file.
- **Web-standard portability.** Everything is `fetch` and `crypto.subtle`. The same code would run on Cloudflare Workers, Deno, or anything else that speaks the Web Platform — which matters for a product whose [pitch includes self-hosting](/blog/the-case-for-self-hostable-ai-support).

What we paid:

- **We are now the maintainers of clients that vendors used to maintain.** When Stripe ships a new API version or deprecates an endpoint, nobody bumps a package for us — we read the changelog and edit `stripe.ts` ourselves.
- **We own security-sensitive code most teams never touch.** Two webhook verifiers with constant-time comparison and replay windows are now _our_ code to get right, test, and keep right.
- **The vendor's docs are the spec.** Undocumented SDK behavior — encoding quirks, retry defaults, the metered-price-quantity rule — has to be rediscovered by us, sometimes the hard way.

On balance: yes, for us, clearly — but the honest framing is that we traded operational risk for maintenance responsibility. That trade favors a small team with a simple API surface and strong tests. If your backend touches twenty vendor APIs with fast-moving surfaces, hand-rolling twenty clients is a much worse deal, and a Node runtime that just runs the official SDKs is a defensible choice.

If you do make the jump, start where we should have: not with your `package.json`, but with `npm ls --all` and a hard look at what your dependencies' dependencies drag in. The SDK that breaks your deploy is never the one you imported.

## FAQ

### Does Hono work on workerd?

Yes, natively — Hono was designed for Web-standard runtimes and is arguably at its best there. Drizzle (against a D1-compatible SQLite binding), Zod, Better Auth core, and the Vercel AI SDK v6 all bundle and run fine for us too.

### How do you verify Stripe webhooks without the Stripe SDK?

Recompute the HMAC-SHA256 of `${timestamp}.${rawBody}` with `crypto.subtle` using your webhook secret, compare it to the `v1` value from the `stripe-signature` header with a constant-time comparison, and reject signatures older than a tolerance window (we use 300 seconds). It's about 50 lines; the scheme is fully documented by Stripe.

### How do you serve static assets from a worker with no filesystem?

Embed them at build time. Our post-build script writes the compiled widget bundle into a generated TypeScript module as a string constant, and the worker serves it from memory with a five-minute cache header. Atomic versioning with the API comes free.

### Is workerd the same as Cloudflare Workers?

workerd is the open-source runtime that powers Cloudflare Workers. We deploy to it via the Ploy platform rather than Cloudflare directly, but the compatibility constraints in this post — no Node built-ins, no filesystem, per-isolate memory, env as a binding — apply the same way on either.
