# @clankersupport/widget-rsc

The [Clanker Support](https://clankersupport.com) AI support widget as a **React Server Components package**. One component in your Next.js root layout puts an AI support agent on every page — and when you want your own UI, the same package gives you **headless primitives and hooks** with zero styling attached.

- **RSC-first** — the entry is a Server Component that prefetches your widget config on the server (cached, revalidated every 5 min) and streams in via Suspense, so it never blocks or breaks your page.
- **Headless underneath** — the styled widget is built entirely from exported unstyled primitives (`Trigger`, `Panel`, `Messages`, `Composer`, …) and a single `useClankerSupport()` hook. Use as much or as little as you want.
- **Zero dependencies** — React is the only peer. The AI streaming protocol, storage, and API client are self-contained.
- **Full feature set** — streaming AI answers, human escalation (email + Slack), operator replies appearing live via polling, per-message 👍/👎, CSAT, plan-gated branding.
- **Open source & self-hostable** — point `apiUrl` at your own [llmchat](https://github.com/theopenco/llmchat) deployment.

## Install

```sh
npm install @clankersupport/widget-rsc
# pnpm add / yarn add / bun add
```

Requires React 19 (Next.js 15+ App Router, or any RSC framework).

## Quick start

Grab your project's public key from the dashboard (Project → Embed), then add the widget to `app/layout.tsx`:

```tsx
import { ClankerSupport } from "@clankersupport/widget-rsc";

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body>
				{children}
				<ClankerSupport apiKey="pk_your_project_key" />
			</body>
		</html>
	);
}
```

That's it. A launcher bubble appears bottom-right on every page; visitors get streaming AI answers from your knowledge base, can escalate to a human, and operator replies from the dashboard inbox show up in the widget live.

> The public key is safe to expose — it's the same key the `<script>` embed uses. Keep it in an env var if you prefer: `apiKey={process.env.NEXT_PUBLIC_CLANKER_KEY!}`.

### Props

| Prop                  | Type                              | Default                          | What it does                                                                      |
| --------------------- | --------------------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| `apiKey`              | `string` (required)               | —                                | Your project's public widget key.                                                 |
| `apiUrl`              | `string`                          | `https://api.clankersupport.com` | API origin. Point at your own deployment when self-hosting.                       |
| `brandColor`          | `string`                          | `#111827`                        | Accent color (launcher, header, user bubbles).                                    |
| `position`            | `"bottom-right" \| "bottom-left"` | `"bottom-right"`                 | Which corner the widget docks to.                                                 |
| `title`               | `string`                          | `"Support"`                      | Panel header title.                                                               |
| `greeting`            | `string \| null`                  | `"Hi! How can I help?"`          | Greeting bubble copy (personalized when the visitor identifies). `null` hides it. |
| `escalationThreshold` | `number`                          | `3`                              | User messages before "Talk to a human" appears.                                   |
| `defaultOpen`         | `boolean`                         | `false`                          | Open the panel on mount.                                                          |
| `className`           | `string`                          | —                                | Extra class on the fixed container (handy for CSS-variable re-theming).           |

### Restyling the default widget

Everything is plain, namespaced CSS — `.clanker-*` classes driven by CSS custom properties. No shadow DOM, so your stylesheet wins:

```css
.clanker-root {
	--clanker-brand: #16a34a;
	--clanker-surface: #0b0f14;
	--clanker-text: #e5e7eb;
	--clanker-bubble: #1f2937;
	--clanker-border: #1f2937;
}
.clanker-panel {
	border-radius: 8px;
}
```

If you need more than re-theming, go headless.

## Headless

`@clankersupport/widget-rsc/headless` exports the provider, unstyled primitives, and the hook. Primitives render semantic elements with `data-*` state attributes and forward every native prop; interactive ones support `asChild` (Radix-style) to render your own component instead.

```tsx
"use client";

import * as SupportChat from "@clankersupport/widget-rsc/headless";

export function HelpButton() {
	return (
		<SupportChat.Root apiKey="pk_your_project_key">
			<SupportChat.Trigger className="btn">Need help?</SupportChat.Trigger>
			<SupportChat.Panel className="my-panel">
				<SupportChat.Messages className="my-thread">
					{(message) => (
						<div className={`bubble bubble--${message.role}`}>
							{message.content}
						</div>
					)}
				</SupportChat.Messages>
				<SupportChat.EscalateButton className="link">
					Talk to a human
				</SupportChat.EscalateButton>
				<SupportChat.Composer className="row">
					<SupportChat.Input className="input" placeholder="Ask anything…" />
					<SupportChat.Submit className="btn">Send</SupportChat.Submit>
				</SupportChat.Composer>
				<SupportChat.Branding />
			</SupportChat.Panel>
		</SupportChat.Root>
	);
}
```

### Primitives

| Component        | Renders                | Notes                                                                                                     |
| ---------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `Root`           | context only           | Alias of `ClankerSupportProvider`; accepts the same props as `ClankerSupport` (minus styling ones).       |
| `Trigger`        | `<button>`             | Toggles the panel. `aria-expanded`, `aria-controls`, `data-state="open" \| "closed"`. Supports `asChild`. |
| `Panel`          | `<div role="dialog">`  | Unmounted while closed (`forceMount` keeps it for CSS animations). Focuses on open, closes on Escape.     |
| `Messages`       | `<div role="log">`     | Function child = your row markup; default rows are `<div data-part="message" data-role>`. Auto-scrolls.   |
| `Composer`       | `<form>`               | Submits the shared draft via `send()`.                                                                    |
| `Input`          | `<input>`              | Bound to the shared draft. Typing stays enabled while a reply streams.                                    |
| `Submit`         | `<button type=submit>` | Disabled while sending or when the draft is empty. `data-state="busy" \| "idle"`. Supports `asChild`.     |
| `EscalateButton` | `<button>`             | Renders **nothing** until the visitor may escalate; hides again after. Supports `asChild`.                |
| `ResolveButton`  | `<button>`             | Renders nothing until the conversation can be marked resolved. Supports `asChild`.                        |
| `Branding`       | `<a>`                  | Plan-gated "Powered by" attribution (decided server-side). Style it freely; on free plans it must render. |

### The hook

Skip components entirely and drive everything yourself:

```tsx
"use client";

import { useClankerSupport } from "@clankersupport/widget-rsc/headless";

function MyComposer() {
	const { messages, status, send, escalate, canEscalate } = useClankerSupport();

	return (
		<>
			{messages.map((m) => (
				<p key={m.id} data-role={m.role}>
					{m.content}
				</p>
			))}
			{status === "streaming" && <Spinner />}
			<button onClick={() => send("Where is my order?")}>Ask</button>
			{canEscalate && <button onClick={escalate}>Get a human</button>}
		</>
	);
}
```

`useClankerSupport()` returns (see `ClankerSupportContextValue` for the full typed surface):

- **Conversation** — `messages` (merged server feed + in-flight local state), `status` (`idle | submitted | streaming | error`), `send(text?)`, `draft` / `setDraft`, `errorMessage`, `errorCode` (machine-readable API code, e.g. `subscription_required`), `conversationId`, `refresh()`.
- **Panel** — `open`, `setOpen`, `toggle`.
- **Identity** — `identity`, `identify({ name, email })` (persisted 30 days, per project).
- **Handoff** — `canEscalate`, `escalate()`, `escalated`, `escalationSummary`, `canResolve`, `resolve()`, `resolved`, plus pending/failed flags.
- **Feedback** — `rate(messageId, "up" | "down")` (optimistic with rollback), `csatEligible`, `submitCsat(1–5)`.
- **Config** — `showBranding`, `privacyPolicyUrl`, `brandColor`, `position`, `greeting`.

## How it works

- **Server-side config prefetch.** `ClankerSupport` is an async Server Component: it fetches `GET /v1/config/:key` on the server (Next.js Data Cache, `revalidate: 300`) and passes the result to the client — one less client round-trip, no branding flash. The fetch is wrapped in `<Suspense fallback={null}>` and fails soft, so a slow or down API never blocks or breaks your page.
- **Streaming.** `send()` POSTs the conversation to `/v1/chat` and reads the AI SDK UI-message stream directly (a ~90-line SSE reader — no `ai` dependency), updating the assistant bubble per delta.
- **Live operator replies.** While the panel is open, the persisted conversation feed is polled every 2.5s and merged with local in-flight state, so replies sent from the dashboard inbox (or by email) appear without a refresh.
- **Escalation semantics** mirror the first-party widget: escalated state hydrates from the server (a reload can't re-fire notifications), the bot stays muted while a human owns the conversation, and visitors can't resolve an escalated thread.
- **Script-widget compatible storage.** The SDK uses the same `localStorage`/`sessionStorage` keys as the `<script>` embed, so migrating from the script tag keeps existing visitor conversations and identities.

## Using it from a Client Component

The root export is a Server Component. If your layout (or the spot you're mounting from) is a Client Component, import the same widget from the headless entry instead — identical UI, config fetched client-side:

```tsx
"use client";

import { ClankerSupportWidget } from "@clankersupport/widget-rsc/headless";

<ClankerSupportWidget apiKey="pk_your_project_key" />;
```

## Self-hosting

Clanker Support is open source ([theopenco/llmchat](https://github.com/theopenco/llmchat)). Run your own API and pass its origin:

```tsx
<ClankerSupport apiKey="pk_…" apiUrl="https://support-api.your-domain.com" />
```

## License

See the repository license: [theopenco/llmchat](https://github.com/theopenco/llmchat).
