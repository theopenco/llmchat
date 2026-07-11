---
title: "Everything that broke while shipping an embeddable AI widget"
description: "A support widget runs inside a DOM you don't control. Here's every way host pages broke ours — :empty selectors, 62.5% root font-sizes, null currentScript — and the rule we extracted from each fix."
seoDescription: "War stories from shipping an embeddable widget: Shopify Dawn's div:empty bug, rem vs shadow DOM, currentScript timing, and serving JS with no filesystem."
date: "2026-07-11"
category: "Engineering"
featured: false
cover: "/blog/shipping-an-embeddable-widget.jpg"
coverAlt: "Dark code window on a violet gradient showing the createWidgetHost function with an inline display:block !important fix"
---

Here is what broke while shipping the Clanker Support widget as a one-script-tag embed: Shopify's Dawn theme hid it entirely with `div:empty { display: none }`; a 62.5% root font-size shrank it to 10/16 scale straight through the shadow DOM; `document.currentScript` was null when we read it too late; and our server had no filesystem to serve the bundle from. Each breakage became a rule; this post walks through all of them.

An embedded widget is a strange artifact. It's a React app, but it runs inside a page built by someone else, styled by someone else, bundled by someone else, and served from infrastructure you'll never see. Every assumption a normal web app gets for free — sane resets, a 16px root, a predictable script lifecycle — is up for grabs. Shadow DOM helps less than you'd hope, and we'll get precise about exactly where it stops helping.

## Why the widget is one file

The widget is a Vite lib build, IIFE format only, one entry (`src/mount.tsx`), one output (`widget.js`). Two config lines do most of the work:

- **`inlineDynamicImports: true`** — no lazy chunks, ever. A second chunk means a second network fetch from a URL the bundle has to compute at runtime, on a page whose base URL, CSP, and bundler you don't control. One file has one failure mode.
- **`cssCodeSplit: false`** — the CSS ships inside the JS (more on how below).

Single-file IIFE has a sharp edge, though: every transitive dynamic import in your dependency tree gets inlined whether you wanted it or not. Our markdown renderer, Streamdown, lazy-loads `mermaid` to render diagram blocks. In an app that's a nice deferred chunk; in an inlined IIFE it's the whole mermaid library riding along in `widget.js` for a feature support replies will never use. The fix is an alias to a stub:

````ts
	resolve: {
		alias: {
			// Streamdown lazy-loads mermaid for ```mermaid blocks. The widget is a
			// single inlined IIFE, so that lazy chunk gets inlined and would pull in
			// the whole (~MB) mermaid library. Support replies never contain
			// diagrams, so alias it to a no-op stub to keep widget.js small.
			mermaid: fileURLToPath(new URL("./src/mermaid-stub.ts", import.meta.url)),
		},
	},
````

The stub is a no-op object: `initialize()` does nothing, `render()` returns `{ svg: "" }`. If a diagram block ever appears, it renders nothing instead of costing every visitor the download.

One more lib-mode gotcha: Vite keeps React's `process.env.NODE_ENV` references in a lib build, and there is no `process` in a browser. Without `define: { "process.env.NODE_ENV": JSON.stringify("production") }`, the widget throws a ReferenceError on the very first page it's embedded in.

**Rule: ship a single-file IIFE, and audit what inlining drags in.** Every dynamic import in your dependency tree is a hidden passenger.

## Shadow DOM isolates selectors, not the cascade

We mount into a shadow root: append a host `<div>` to `document.body`, `attachShadow({ mode: "open" })`, inject a `<style>` element, render React into it. Host-page selectors can't reach inside; our selectors can't leak out. That's the sales pitch, and the part about _selectors_ is true.

But two things pass straight through the shadow boundary: **inherited properties** and **unit resolution**. The host page's `font-family`, `line-height`, `text-align`, and `letter-spacing` all inherit into your shadow tree unless you pin them. So the top of our stylesheet is a wall of explicit values — `font-size: 16px`, `line-height: 1.5`, `letter-spacing: normal`, `text-align: left` on `:host` — plus a `box-sizing: border-box` reset on every element, because host pages love universal selectors and you don't get to assume `content-box` never leaked in from a parent frame's expectations.

We thought that wall made us safe. Then we tested the Shopify theme-app extension on a Dawn dev store, and the host page got us twice in one afternoon — once by reaching _around_ the shadow DOM, once by reaching _through_ it.

## The day the widget vanished on Shopify Dawn: div:empty

First bug: on a stock Dawn store, the widget didn't render. Not broken — absent. No bubble, no errors, nothing.

The diagnosis is the kind you only get by staring at computed styles. All of the widget's content lives in the shadow root. From the light DOM's point of view, the host `<div>` we append to `document.body` has no children — it is, structurally, empty. And Shopify's Dawn theme ships this in `base.css`:

```css
div:empty {
	display: none;
}
```

A perfectly reasonable rule for a theme to ship, and it hides your entire embed. The host page's stylesheet never touched a single element inside our shadow root — it didn't need to. It matched the one element we own in the light DOM and removed it from layout, shadow tree and all. Dawn is Shopify's default theme, so this was every Dawn-based store, which is a lot of stores.

The fix is one small function (commit `e18586e`, shipped as PR #111):

```ts
export function createWidgetHost(doc: Document): HTMLDivElement {
	const host = doc.createElement("div");
	host.id = "llmchat-widget-root";
	host.style.setProperty("display", "block", "important");
	return host;
}
```

Why an _inline_ important declaration and not a rule in our stylesheet? Because our stylesheet lives in the shadow root, and the `div:empty` rule matches a light-DOM element — a shadow style can't win that fight. In the cascade, an important inline declaration outranks any stylesheet rule, important or not. It's the one place we can plant a flag the host page cannot override short of JavaScript.

**Rule: your shadow host is `:empty` in the light DOM — plan for it.** Either your host element has light-DOM content, or you defend its `display` with an inline important declaration like we did. Hiding empty divs is a common theme pattern; assume it's out there.

## 38 minutes later: rem resolves through shadow DOM

With the bubble finally visible on Dawn, the second bug was immediately obvious: the widget was tiny. The 56×56px launcher bubble measured 35×35. Panel text rendered around 10px. Everything was scaled by exactly 10/16.

That fraction is the tell. Dawn — like a lot of themes and older CSS codebases — sets `html { font-size: 62.5% }` so that `1rem = 10px` for convenient arithmetic. And here's the part that surprises people: **`rem` resolves against the host page's root font-size even inside shadow DOM**. The shadow boundary doesn't intervene. `rem` means "root em," and the root is `<html>` — the host's `<html>`. There's no shadow-local root to resolve against.

Our stylesheet had 160 `rem` values in it. Every one of them was silently multiplied by 10/16 on any 62.5%-root page. Note what _didn't_ break: text that inherited from our pinned `font-size: 16px` was fine, which is exactly why the widget had looked correct everywhere else — the font-size pin protected inherited text while every `rem`-denominated _dimension_ (padding, radii, the bubble itself) quietly depended on a root we don't own.

The fix (commit `445af84`, PR #113, 38 minutes after the Dawn fix) was mechanical: multiply all 160 values by 16 and write them as px. A 273-line diff of pure unit conversion, and a comment in the stylesheet so nobody "modernizes" it back:

```css
/* Pin inherited properties so the host page's typography can't leak across
	   the shadow boundary and distort the widget. Dimensions are px throughout
	   (never rem): rem resolves against the HOST page's root font-size even
	   inside shadow DOM — Shopify's Dawn sets html to 62.5%, which shrank the
	   whole widget to 10/16 scale. */
line-height: 1.5;
font-size: 16px;
```

Inside an app you control, `rem` is good practice — it respects user font-size preferences. Inside an embed, `rem` is an unversioned runtime dependency on a value the host page sets. Those are different products with different rules.

**Rule: in an embed, ship px, not rem.** The two Dawn bugs make a matched pair, and together they're the thesis of this post: shadow DOM isolates _selectors_. It does not isolate inheritance, and it does not isolate unit resolution. The host page reached around our shadow root (the `:empty` match on the light-DOM host) and through it (rem resolving against the host root) on the same day, two PRs apart.

## Things nobody tells you about script-tag embeds

Two smaller breakages, both about the `<script>` tag itself rather than CSS.

**`document.currentScript` is a now-or-never API.** The widget reads its config from data attributes on its own script tag — `data-project`, `data-api`, `data-brand`, `data-mode`. To find "its own script tag" it uses `document.currentScript`, which is only set during synchronous evaluation of the script. Defer your config read into a `DOMContentLoaded` callback — the natural place, since you can't mount before the body exists — and `currentScript` is null. So the config capture and the mount are split:

```ts
// document.currentScript is only set during synchronous script evaluation —
// it is null inside the DOMContentLoaded callback — so capture config now.
const config = resolveConfig(
	document.currentScript as HTMLScriptElement | null,
);
```

Config is resolved at top level, synchronously, the moment the script evaluates; only the DOM mount waits for `readyState`.

**Derive your API origin from the script's own src.** Where should the widget send chat requests? The obvious answer — hardcode the production API host — is a trap: every local dev embed, staging embed, and self-hosted install would silently talk to prod. The correct default was sitting in the script tag all along:

```ts
const apiUrl =
	script?.dataset.api ??
	(script?.src ? new URL(script.src).origin : window.location.origin);
```

Whatever origin served `widget.js` is, by construction, an origin running our API — the API is what serves the widget bundle. Local dev loads the widget from localhost and talks to localhost; a self-hosted install (the whole thing is open source and [self-hostable](/blog/the-case-for-self-hostable-ai-support)) talks to itself; `data-api` remains as an explicit override. No environment detection, no build-time host baking.

**Rule: capture `currentScript` synchronously, and make the script's own origin your API default.**

## Serving widget.js from a server with no filesystem

Our API runs on workerd — the Cloudflare-workers-compatible runtime — where there is no filesystem to read a built asset from. But `/widget.js` has to come from somewhere, ideally the same origin as the API (see the previous rule).

The answer is unglamorous: after `vite build`, a script reads `dist/widget.js` and writes it into a generated TypeScript module as one JSON-stringified constant. The API imports that module and serves the string from memory with `content-type: application/javascript`, `x-content-type-options: nosniff`, and `cache-control: public, max-age=300`. The generated file is gitignored; the API's deploy pipeline builds the widget first, so the constant is always fresh.

The five-minute cache is a deliberate embed-specific choice. Host pages pin your URL in their HTML forever — you can't cache-bust an asset whose URL is copy-pasted into `<script>` tags in HTML you don't control. Short max-age means a shipped fix (like either Dawn fix) reaches every embed within minutes, at the cost of more origin hits. For a support widget, that trade is easy.

**Rule: an embed URL is immutable to you, so keep its cache lifetime short.**

## The iframe fallback and its upside-down CSP

Some environments can't or won't run third-party script tags — strict CSPs, locked-down site builders, "no external JS" policies. For those we serve `/embed/<key>`: a full-page chat shell designed to be iframed. (For hosts that _do_ give you a real integration surface, we've written up the [React Server Components install](/blog/nextjs-ai-support-widget-server-component) and the [WordPress plugin](/blog/wordpress-ai-support-plugin) separately.)

Writing the CSP for that page was a small lesson in itself, because it's a normal CSP turned inside out:

```ts
c.header(
	"content-security-policy",
	"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors *",
);
```

Every app-hardening guide tells you to lock down `frame-ancestors`. Here `frame-ancestors *` is the entire point — being framed by arbitrary sites is the product — so everything _else_ gets locked to nothing: no forms, no base-URI tricks, scripts and connections from self only. `style-src 'unsafe-inline'` looks alarming until you remember the widget's whole stylesheet is one `<style>` element in a shadow root; that's the mechanism, not a compromise.

One subtle line in that page: the widget script src is _relative_, not an absolute URL built from the request. Behind a TLS-terminating proxy the worker sees `http://`, and an absolute `http://` script URL on an `https://` page is mixed content — blocked before your code ever runs. A relative src inherits the page's real scheme and sidesteps the whole class of bug.

## The rules, collected

- **Ship a single-file IIFE.** Inline dynamic imports; stub out heavyweight transitive lazy-loads (our mermaid alias) instead of shipping them.
- **Define `process.env.NODE_ENV` at build time.** Vite lib mode won't do it for you, and browsers have no `process`.
- **Pin every inherited property at your shadow root.** Font, line-height, letter-spacing, text-align, plus a box-sizing reset. Shadow DOM only isolates selectors.
- **Your shadow host is `:empty` in the light DOM.** Give it light-DOM content or defend `display` with an inline important declaration; theme CSS that hides empty divs is real and widespread.
- **Ship px, not rem.** Inside an embed, rem is a dependency on the host page's root font-size — even through shadow DOM.
- **Capture `document.currentScript` synchronously.** It's null by the time `DOMContentLoaded` fires.
- **Default your API origin to `new URL(script.src).origin`.** Never a hardcoded host; keep an explicit override attribute.
- **Serve the bundle from your API's origin with a short max-age.** Embed URLs are pinned in HTML you don't control; five minutes is our propagation ceiling for fixes.
- **If you offer an iframe mode, invert the CSP.** `frame-ancestors *` on purpose, everything else `'none'` or `'self'`, and a relative script src so TLS-terminating proxies can't hand you mixed content.

All of this code is public — the widget, the stub, both Dawn fixes with their commit messages — in the [repo](https://github.com/theopenco/llmchat), and you can poke the live widget at [showcase.clankersupport.com](https://showcase.clankersupport.com). If you're building your own embed, steal the rules; we already paid for them, one Dawn dev store at a time.
