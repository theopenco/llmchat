// Source of truth for the widget's shadow-DOM stylesheet. Exported as a
// string so it can be consumed from both Vite (IIFE bundle) and Next.js
// (server-rendered host page) without bundler-specific `?inline` syntax.
export const widgetStyles = `
/* ── Theme tokens ──────────────────────────────────────────────────────
   Light is the default palette (existing embeds render unchanged); the
   .llmchat--dark class — set by WidgetFrame from the resolved theme
   (data-theme: light | dark | auto) — overrides the same custom properties.
   On-brand surfaces (header, visitor bubbles, send) keep literal #fff text
   on var(--brand) in both themes, so they are deliberately not tokenized. */
:host,
.llmchat {
	/* Surfaces */
	--sf: #fff;
	--sf-2: #f3f4f6;
	--sf-3: #f9fafb;
	/* Ink */
	--tx: #111827;
	--tx-2: #374151;
	--tx-3: #4b5563;
	--tx-4: #6b7280;
	--tx-5: #9ca3af;
	/* Lines */
	--ln: #e5e7eb;
	--ln-2: #d1d5db;
	--ln-soft: #f1f5f9;
	/* Operator (admin) replies */
	--ok-bg: #ecfdf5;
	--ok-tx: #065f46;
	--ok-ln: #a7f3d0;
	/* Informational band (demo note) */
	--info-bg: #eef2ff;
	--info-tx: #4338ca;
	--info-ln: #e0e7ff;
	--err: #b91c1c;
	/* Markdown chrome (code, quotes, tables) */
	--code-bg: rgba(0, 0, 0, 0.06);
	--pre-bg: rgba(0, 0, 0, 0.05);
	--md-ln: rgba(0, 0, 0, 0.12);
	--md-hr: rgba(0, 0, 0, 0.1);
	--th-bg: rgba(0, 0, 0, 0.04);
	color-scheme: light;
}
.llmchat--dark {
	--sf: #111827;
	--sf-2: #1f2937;
	--sf-3: #1f2937;
	--tx: #f9fafb;
	--tx-2: #d1d5db;
	--tx-3: #d1d5db;
	--tx-4: #9ca3af;
	--tx-5: #6b7280;
	--ln: #374151;
	--ln-2: #4b5563;
	--ln-soft: #1f2937;
	--ok-bg: #022c22;
	--ok-tx: #6ee7b7;
	--ok-ln: #065f46;
	--info-bg: #1e1b4b;
	--info-tx: #a5b4fc;
	--info-ln: #312e81;
	--err: #f87171;
	--code-bg: rgba(255, 255, 255, 0.09);
	--pre-bg: rgba(255, 255, 255, 0.07);
	--md-ln: rgba(255, 255, 255, 0.16);
	--md-hr: rgba(255, 255, 255, 0.12);
	--th-bg: rgba(255, 255, 255, 0.05);
	color-scheme: dark;
}

:host,
.llmchat {
	font-family:
		system-ui,
		-apple-system,
		Segoe UI,
		sans-serif;
	color: var(--tx);
	/* Pin inherited properties so the host page's typography can't leak across
	   the shadow boundary and distort the widget. Dimensions are px throughout
	   (never rem): rem resolves against the HOST page's root font-size even
	   inside shadow DOM — Shopify's Dawn sets html to 62.5%, which shrank the
	   whole widget to 10/16 scale. */
	line-height: 1.5;
	font-size: 16px;
	letter-spacing: normal;
	text-align: left;
}

/* Reset box model for every widget element so the host page's global styles
   (e.g. a content-box universal selector) can't change our layout. */
.llmchat *,
.llmchat *::before,
.llmchat *::after {
	box-sizing: border-box;
}

/* ── Floating launcher ─────────────────────────────────────────────── */
.llmchat-bubble {
	position: fixed;
	bottom: 20px;
	right: 20px;
	width: 56px;
	height: 56px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 9999px;
	background: var(--brand);
	color: #fff;
	border: none;
	cursor: pointer;
	box-shadow:
		0 8px 24px -6px rgba(0, 0, 0, 0.4),
		0 2px 6px rgba(0, 0, 0, 0.18);
	z-index: 2147483646;
	transition:
		transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
		box-shadow 0.18s ease;
}
.llmchat-bubble:hover {
	transform: translateY(-2px) scale(1.04);
	box-shadow:
		0 12px 28px -6px rgba(0, 0, 0, 0.45),
		0 3px 8px rgba(0, 0, 0, 0.2);
}
.llmchat-bubble:active {
	transform: scale(0.95);
}
.llmchat-bubble:focus-visible {
	outline: none;
	box-shadow:
		0 0 0 3px #fff,
		0 0 0 6px var(--brand);
}
.llmchat-bubble-icon {
	display: flex;
	animation: llmchat-pop 0.2s ease;
}
@keyframes llmchat-pop {
	from {
		opacity: 0;
		transform: scale(0.5) rotate(-12deg);
	}
	to {
		opacity: 1;
		transform: none;
	}
}

/* Unread count — messages that landed while the panel was closed (usually the
   human's reply after an escalation). Inverted brand chrome: the launcher itself
   is var(--brand), so a brand-filled badge on it would be invisible; a white pill
   with brand text and a brand ring reads as part of the same object and needs no
   new hue (deliberately NOT notification-red — this is a support reply, not an
   alarm). Literal #fff in both themes, like every other on-brand surface. */
.llmchat-bubble-badge {
	position: absolute;
	top: -2px;
	right: -2px;
	min-width: 22px;
	height: 22px;
	padding: 0 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 9999px;
	background: #fff;
	color: var(--brand);
	border: 2px solid var(--brand);
	/* px, never rem: rem resolves against the HOST page's root font-size even
	   inside shadow DOM (Shopify's Dawn sets html to 62.5%). */
	font-size: 11.7px;
	font-weight: 700;
	line-height: 1;
	font-variant-numeric: tabular-nums;
	/* direction inherits across the shadow boundary: on an RTL host page the
	   trailing "+" of "9+" is bidi-neutral and would reorder to "+9". */
	direction: ltr;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.22);
	animation: llmchat-badge-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes llmchat-badge-in {
	from {
		opacity: 0;
		transform: scale(0.4);
	}
	to {
		opacity: 1;
		transform: none;
	}
}

/* Announced, never seen: the live region that tells a screen reader a reply
   arrived while the panel was closed. */
.llmchat-sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0 0 0 0);
	clip-path: inset(50%);
	white-space: nowrap;
	border: 0;
}

/* ── Panel ─────────────────────────────────────────────────────────── */
.llmchat-panel {
	position: fixed;
	bottom: 88px;
	right: 20px;
	width: 368px;
	max-width: calc(100vw - 32px);
	height: 544px;
	max-height: calc(100vh - 112px);
	background: var(--sf);
	border-radius: 16px;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	transform-origin: bottom right;
	/* Layered shadow + hairline ring so the panel reads on dark host pages. */
	box-shadow:
		0 24px 56px -16px rgba(0, 0, 0, 0.45),
		0 0 0 1px rgba(0, 0, 0, 0.06);
	z-index: 2147483647;
	animation: llmchat-panel-in 0.24s cubic-bezier(0.16, 1, 0.3, 1);
	transition:
		width 0.24s cubic-bezier(0.16, 1, 0.3, 1),
		height 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
/* Expanded (large) panel — bubble layout only. The base max-width/max-height
   caps still apply, so small viewports simply fill the available space. */
.llmchat-panel--expanded {
	width: 680px;
	height: 820px;
}
.llmchat-panel--closing {
	animation: llmchat-panel-out 0.18s ease forwards;
}
@keyframes llmchat-panel-in {
	from {
		opacity: 0;
		transform: translateY(14px) scale(0.96);
	}
	to {
		opacity: 1;
		transform: none;
	}
}
@keyframes llmchat-panel-out {
	from {
		opacity: 1;
		transform: none;
	}
	to {
		opacity: 0;
		transform: translateY(10px) scale(0.98);
	}
}

/* Inline mode: the panel fills its container — the whole viewport on the
   /embed iframe page, or a position:relative wrapper when mounted in-page. */
.llmchat-panel-inline {
	position: absolute;
	inset: 0;
	width: auto;
	max-width: none;
	height: auto;
	max-height: none;
	border-radius: 0;
	box-shadow: none;
	animation: none;
}

/* ── Header ────────────────────────────────────────────────────────── */
.llmchat-header {
	background: var(--brand);
	color: #fff;
	padding: 14px 16px;
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}
.llmchat-header-id {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}
.llmchat-header-avatar {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border-radius: 9999px;
	background: rgba(255, 255, 255, 0.22);
	flex-shrink: 0;
}
.llmchat-header-avatar svg {
	width: 16.8px;
	height: 16.8px;
}
.llmchat-header-text {
	font-weight: 600;
	font-size: 15.2px;
	letter-spacing: 0.01em;
}
/* Header buttons (new conversation / expand / close) grouped on the right.
   The container owns the push-right so multiple buttons stay adjacent instead
   of each fighting for margin-left: auto. */
.llmchat-header-actions {
	margin-left: auto;
	display: flex;
	align-items: center;
	gap: 2px;
	flex-shrink: 0;
}
.llmchat-icon-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border-radius: 8px;
	background: transparent;
	border: none;
	color: #fff;
	cursor: pointer;
	opacity: 0.85;
	transition:
		background 0.15s ease,
		opacity 0.15s ease;
}
.llmchat-icon-btn:hover {
	background: rgba(255, 255, 255, 0.18);
	opacity: 1;
}
.llmchat-icon-btn:focus-visible {
	outline: none;
	box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
}

/* ── Identify form ─────────────────────────────────────────────────── */
.llmchat-identify {
	padding: 24px 20px;
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.llmchat-identify-intro {
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.llmchat-identify-title {
	margin: 0;
	font-size: 18.4px;
	font-weight: 700;
}
.llmchat-identify-sub {
	margin: 0;
	font-size: 14px;
	color: var(--tx-4);
}
.llmchat-field {
	display: flex;
	flex-direction: column;
	gap: 4.8px;
}
.llmchat-field-label {
	font-size: 12.48px;
	font-weight: 600;
	color: var(--tx-4);
}
.llmchat-identify input,
.llmchat-input textarea {
	width: 100%;
	border: 1px solid var(--ln-2);
	border-radius: 10px;
	padding: 8.8px 12px;
	font: inherit;
	font-size: 14.4px;
	color: var(--tx);
	background: var(--sf);
	resize: none;
	transition:
		border-color 0.15s ease,
		box-shadow 0.15s ease;
}
.llmchat-identify input::placeholder,
.llmchat-input textarea::placeholder {
	color: var(--tx-5);
}
.llmchat-identify input:focus,
.llmchat-input textarea:focus {
	outline: none;
	border-color: var(--brand);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent);
}
.llmchat-identify button {
	margin-top: 4px;
	background: var(--brand);
	color: #fff;
	border: none;
	border-radius: 10px;
	padding: 9.6px 12px;
	font: inherit;
	font-size: 14.4px;
	font-weight: 600;
	cursor: pointer;
	transition:
		filter 0.15s ease,
		transform 0.1s ease;
}
.llmchat-identify button:hover {
	filter: brightness(1.07);
}
.llmchat-identify button:active {
	transform: translateY(1px);
}
.llmchat-identify button:disabled {
	opacity: 0.5;
	cursor: default;
}

/* ── Messages ──────────────────────────────────────────────────────── */
.llmchat-messages {
	/* position:relative so a message's offsetTop is measured against this scroll
	   container — useAnchoredScroll relies on it to pin the latest turn to the top. */
	position: relative;
	flex: 1;
	overflow-y: auto;
	padding: 16px 14px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	background: var(--sf);
	scrollbar-width: thin;
	scrollbar-color: var(--ln-2) transparent;
}
/* Bottom spacer that lets the latest visitor message reach the top of the
   viewport; its height is set imperatively by useAnchoredScroll (0 by default). */
.llmchat-anchor-spacer {
	flex: 0 0 auto;
	pointer-events: none;
}
.llmchat-messages::-webkit-scrollbar {
	width: 8px;
}
.llmchat-messages::-webkit-scrollbar-thumb {
	background: var(--ln-2);
	border-radius: 9999px;
	border: 2px solid var(--sf);
}
/* "Scroll to latest": sticky so it floats at the bottom of the scroll area
   while the visitor reads earlier messages during a streaming reply. */
.llmchat-jump {
	position: sticky;
	bottom: 4px;
	align-self: center;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	margin-top: 4px;
	border: none;
	border-radius: 9999px;
	background: var(--brand);
	color: #fff;
	cursor: pointer;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
	transition: transform 0.12s ease;
}
.llmchat-jump:hover {
	transform: translateY(-1px);
}
.llmchat-msg {
	max-width: 85%;
	padding: 8px 12px;
	border-radius: 16px;
	font-size: 14.4px;
	line-height: 1.45;
	white-space: pre-wrap;
	word-break: break-word;
	animation: llmchat-msg-in 0.18s ease;
}
@keyframes llmchat-msg-in {
	from {
		opacity: 0;
		transform: translateY(4px);
	}
	to {
		opacity: 1;
		transform: none;
	}
}
.llmchat-msg-assistant {
	background: var(--sf-2);
	color: var(--tx);
	align-self: flex-start;
	border-bottom-left-radius: 4px;
}
.llmchat-msg-user {
	background: var(--brand);
	color: #fff;
	align-self: flex-end;
	border-bottom-right-radius: 4px;
}
.llmchat-msg-admin {
	background: var(--ok-bg);
	color: var(--ok-tx);
	align-self: flex-start;
	border: 1px solid var(--ok-ln);
	border-bottom-left-radius: 4px;
}
.llmchat-msg-system {
	align-self: center;
	background: var(--sf-2);
	color: var(--tx-4);
	font-size: 12.48px;
	border-radius: 9999px;
	padding: 4px 12px;
}

/* ── Markdown bodies (assistant/agent replies, rendered by Streamdown) ──
   Streamdown emits Tailwind class names we don't ship, so the rendered
   elements are styled here by tag, scoped to the bubble. */
.llmchat-md {
	white-space: normal;
}
.llmchat-md > :first-child {
	margin-top: 0;
}
.llmchat-md > :last-child {
	margin-bottom: 0;
}
.llmchat-md p {
	margin: 0 0 8px;
}
/* Streamdown can emit an empty trailing paragraph while streaming; don't let it
   add a blank line. */
.llmchat-md p:empty {
	display: none;
}
.llmchat-md a {
	color: var(--brand);
	text-decoration: underline;
	text-underline-offset: 2px;
	word-break: break-word;
}
.llmchat-md a:hover {
	text-decoration: none;
}
.llmchat-md ul,
.llmchat-md ol {
	margin: 0 0 8px;
	padding-left: 20px;
}
.llmchat-md li {
	margin: 2.4px 0;
}
.llmchat-md li::marker {
	color: var(--tx-5);
}
.llmchat-md strong {
	font-weight: 600;
}
.llmchat-md em {
	font-style: italic;
}
.llmchat-md h1,
.llmchat-md h2,
.llmchat-md h3,
.llmchat-md h4 {
	margin: 9.6px 0 5.6px;
	font-weight: 600;
	line-height: 1.25;
}
.llmchat-md h1 {
	font-size: 17.6px;
}
.llmchat-md h2 {
	font-size: 16.8px;
}
.llmchat-md h3 {
	font-size: 16px;
}
.llmchat-md h4 {
	font-size: 15.2px;
}
.llmchat-md code {
	font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	font-size: 0.85em;
	background: var(--code-bg);
	padding: 0.1em 0.32em;
	border-radius: 4.8px;
}
.llmchat-md pre {
	margin: 0 0 8px;
	padding: 9.6px 11.2px;
	background: var(--pre-bg);
	border-radius: 8px;
	overflow-x: auto;
	font-size: 0.85em;
	line-height: 1.4;
}
.llmchat-md pre code {
	background: none;
	padding: 0;
	font-size: inherit;
	border-radius: 0;
}
.llmchat-md blockquote {
	margin: 0 0 8px;
	padding-left: 11.2px;
	border-left: 3px solid var(--md-ln);
	opacity: 0.85;
}
.llmchat-md hr {
	border: none;
	border-top: 1px solid var(--md-hr);
	margin: 9.6px 0;
}
.llmchat-md table {
	border-collapse: collapse;
	width: 100%;
	margin: 0 0 8px;
	font-size: 0.85em;
}
.llmchat-md th,
.llmchat-md td {
	border: 1px solid var(--md-ln);
	padding: 4.8px 7.2px;
	text-align: left;
}
.llmchat-md th {
	font-weight: 600;
	background: var(--th-bg);
}
.llmchat-md img {
	max-width: 100%;
	height: auto;
	border-radius: 6.4px;
}

/* ── Per-message rating (assistant thumbs) ─────────────────────────── */
/* Group a bubble with the bits that belong to it — the rating controls, and the
   quote chip of a reply — so they read as one unit. Every message now renders in a
   group, so the group carries the side alignment the bubble used to own. */
.llmchat-msg-group {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	align-self: flex-start;
	gap: 4px;
	max-width: 85%;
}
.llmchat-msg-group[data-role="user"] {
	align-items: flex-end;
	align-self: flex-end;
}
.llmchat-msg-group .llmchat-msg {
	max-width: 100%;
}

/* Quote-reply: the chip above a bubble that replies to an earlier message. */
.llmchat-quote {
	display: flex;
	flex-direction: column;
	gap: 1px;
	max-width: 100%;
	padding: 4px 9px;
	border-left: 2px solid var(--brand);
	border-radius: 6px;
	background: var(--sf-2);
	font-size: 12px;
	line-height: 1.35;
	/* Tucked against the bubble it belongs to (the group's 4px gap stays for the
	   rating row below). */
	margin-bottom: -2px;
}
.llmchat-quote-author {
	color: var(--brand);
	font-weight: 600;
}
.llmchat-quote-text {
	color: var(--tx-2);
	display: -webkit-box;
	-webkit-line-clamp: 1;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
/* Target not in the loaded window (or deleted) — neutral, italic, no text line. */
.llmchat-quote[data-resolved="false"] .llmchat-quote-author {
	color: var(--tx-2);
	font-weight: 400;
	font-style: italic;
}

/* Reply affordance — hidden until hover; always visible where there is no hover
   (touch), which doubles as the long-press target. */
.llmchat-msg {
	position: relative;
}
.llmchat-reply-btn {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
	display: flex;
	align-items: center;
	justify-content: center;
	border: 0;
	background: transparent;
	color: var(--tx-2);
	cursor: pointer;
	padding: 3px;
	border-radius: 6px;
	opacity: 0;
	transition: opacity 120ms ease;
}
.llmchat-msg-user .llmchat-reply-btn {
	left: -26px;
}
.llmchat-msg-assistant .llmchat-reply-btn,
.llmchat-msg-admin .llmchat-reply-btn {
	right: -26px;
}
.llmchat-msg:hover .llmchat-reply-btn,
.llmchat-reply-btn:focus-visible {
	opacity: 1;
}
.llmchat-reply-btn:hover {
	background: var(--sf-2);
	color: var(--tx);
}
@media (hover: none) {
	.llmchat-reply-btn {
		opacity: 0.55;
	}
}

/* "Replying to:" bar above the composer. */
.llmchat-replying {
	display: flex;
	align-items: center;
	gap: 6px;
	margin: 0 14px 6px;
	padding: 6px 10px;
	border-left: 2px solid var(--brand);
	border-radius: 6px;
	background: var(--sf-2);
	font-size: 12px;
	line-height: 1.35;
}
.llmchat-replying-label {
	color: var(--brand);
	font-weight: 600;
	white-space: nowrap;
}
.llmchat-replying-text {
	flex: 1;
	min-width: 0;
	color: var(--tx-2);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.llmchat-replying-dismiss {
	display: flex;
	align-items: center;
	justify-content: center;
	border: 0;
	background: transparent;
	color: var(--tx-2);
	cursor: pointer;
	padding: 2px;
	border-radius: 4px;
	line-height: 1;
}
.llmchat-replying-dismiss:hover {
	background: var(--sf-3, var(--sf-2));
	color: var(--tx);
}
.llmchat-rate {
	display: flex;
	gap: 2px;
	padding-left: 2px;
}
.llmchat-rate-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	border-radius: 6px;
	background: transparent;
	border: none;
	color: var(--tx-5);
	cursor: pointer;
	transition:
		background 0.15s ease,
		color 0.15s ease;
}
.llmchat-rate-btn:hover {
	background: var(--sf-2);
	color: var(--tx-3);
}
/* Pressed = unmistakable: fill the thumb (this CSS fill overrides the inline
   fill="none" on the outline icons) and tint the button, so a registered vote
   reads as clearly selected instead of a faint outline recolor. */
.llmchat-rate-btn[aria-pressed="true"] {
	color: var(--brand);
	background: color-mix(in srgb, var(--brand) 12%, transparent);
}
.llmchat-rate-btn[aria-pressed="true"] svg {
	fill: currentColor;
}
/* "Helpful" presses positive/brand; "Not helpful" presses to a distinct, muted
   "noted" state — the filled thumb registers the vote without reading as
   celebratory, and the darker tint keeps it clearly apart from the brand thumb. */
.llmchat-rate-btn[aria-label="Not helpful"][aria-pressed="true"] {
	color: var(--tx-3);
	background: var(--ln);
}
.llmchat-rate-btn:focus-visible {
	outline: none;
	box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 30%, transparent);
}
.llmchat-rate-btn svg {
	width: 14px;
	height: 14px;
}

/* ── CSAT closing screen ───────────────────────────────────────────── */
.llmchat-csat {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 16px;
	padding: 32px 24px;
	text-align: center;
}
.llmchat-csat-title {
	margin: 0;
	font-size: 16.8px;
	font-weight: 600;
	color: var(--tx);
}
.llmchat-csat-stars {
	display: flex;
	gap: 4px;
}
.llmchat-csat-star {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 4px;
	background: transparent;
	border: none;
	color: #f59e0b;
	cursor: pointer;
	border-radius: 8px;
	transition: transform 0.1s ease;
}
.llmchat-csat-star:hover {
	transform: scale(1.12);
}
.llmchat-csat-star:active {
	transform: scale(0.95);
}
.llmchat-csat-star:focus-visible {
	outline: none;
	box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 30%, transparent);
}
.llmchat-csat-skip {
	background: transparent;
	border: none;
	color: var(--tx-4);
	font: inherit;
	font-size: 13.6px;
	cursor: pointer;
	padding: 4px 8px;
	border-radius: 6px;
}
.llmchat-csat-skip:hover {
	color: var(--tx);
	text-decoration: underline;
}
.llmchat-csat-skip:focus-visible {
	outline: none;
	box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 30%, transparent);
}

/* Typing indicator: three bouncing dots inside an assistant bubble. */
.llmchat-typing {
	display: flex;
	align-items: center;
	gap: 4px;
	width: fit-content;
}
.llmchat-dot {
	width: 6.4px;
	height: 6.4px;
	border-radius: 9999px;
	background: var(--tx-5);
	animation: llmchat-bounce 1.2s infinite ease-in-out;
}
.llmchat-dot:nth-child(2) {
	animation-delay: 0.15s;
}
.llmchat-dot:nth-child(3) {
	animation-delay: 0.3s;
}
/* Shown next to the dots while an integration tool runs (booking, order
   lookup) so a multi-second action doesn't read as a stall. */
.llmchat-typing-label {
	margin-left: 4px;
	font-size: 12px;
	color: var(--tx-4);
}
@keyframes llmchat-bounce {
	0%,
	60%,
	100% {
		transform: translateY(0);
		opacity: 0.5;
	}
	30% {
		transform: translateY(-4px);
		opacity: 1;
	}
}

.llmchat-demo-badge {
	margin-left: auto;
	background: rgba(255, 255, 255, 0.22);
	color: #fff;
	font-size: 11.2px;
	font-weight: 600;
	letter-spacing: 0.03em;
	text-transform: uppercase;
	border-radius: 9999px;
	padding: 2.4px 8px;
}
/* When the demo badge is present it owns the push-right; the action buttons
   just trail it with a small gap. */
.llmchat-demo-badge + .llmchat-header-actions {
	margin-left: 4px;
}
.llmchat-demo-note {
	background: var(--info-bg);
	color: var(--info-tx);
	font-size: 12.48px;
	padding: 8px 14px;
	border-bottom: 1px solid var(--info-ln);
}
/* "Powered by Clanker Support" attribution at the foot of the panel (plan-gated). */
.llmchat-powered-by {
	display: block;
	text-align: center;
	padding: 6.4px 14px 8.8px;
	font-size: 11.2px;
	color: var(--tx-5);
	text-decoration: none;
	border-top: 1px solid var(--ln-soft);
	background: var(--sf);
}
.llmchat-powered-by:hover {
	color: var(--tx-4);
}
.llmchat-powered-by-name {
	font-weight: 600;
	color: var(--tx-4);
}
.llmchat-error {
	color: var(--err);
	font-size: 13.6px;
	margin: 0;
	padding: 4px 8px 0;
}

/* ── Escalation ────────────────────────────────────────────────────── */
.llmchat-escalate,
.llmchat-escalated {
	padding: 10px 14px;
	border-top: 1px solid var(--ln);
	font-size: 13.6px;
	flex-shrink: 0;
}
.llmchat-escalate button {
	display: inline-flex;
	align-items: center;
	gap: 6.4px;
	background: transparent;
	color: var(--brand);
	border: 1px solid color-mix(in srgb, var(--brand) 35%, transparent);
	border-radius: 8px;
	padding: 6.4px 12px;
	font: inherit;
	font-size: 13.6px;
	font-weight: 600;
	cursor: pointer;
	transition:
		background 0.15s ease,
		border-color 0.15s ease;
}
.llmchat-escalate button:hover:not(:disabled) {
	background: color-mix(in srgb, var(--brand) 8%, transparent);
}
.llmchat-escalate button:disabled {
	opacity: 0.55;
	cursor: default;
}
.llmchat-escalated {
	color: var(--tx-3);
	background: var(--sf-3);
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.llmchat-escalated-notice {
	margin: 0;
}
/* "Start a new conversation" inside the resolved band — same treatment as the
   escalate CTA, scoped separately because it lives in .llmchat-escalated. */
.llmchat-restart {
	align-self: flex-start;
	display: inline-flex;
	align-items: center;
	gap: 6.4px;
	background: transparent;
	color: var(--brand);
	border: 1px solid color-mix(in srgb, var(--brand) 35%, transparent);
	border-radius: 8px;
	padding: 6.4px 12px;
	font: inherit;
	font-size: 13.6px;
	font-weight: 600;
	cursor: pointer;
	transition:
		background 0.15s ease,
		border-color 0.15s ease;
}
.llmchat-restart:hover {
	background: color-mix(in srgb, var(--brand) 8%, transparent);
}
.llmchat-restart:focus-visible {
	outline: none;
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 30%, transparent);
}

/* ── Escalation handoff summary card ───────────────────────────────── */
/* A one-time recap shown after escalation — not a chat bubble. Brand-tinted so
   it stands off the gray band; body uses neutral ink so it stays readable for
   any brand hue. Rendered only when the server returned a non-empty summary. */
.llmchat-summary {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 8px 10px;
	border-radius: 10px;
	border: 1px solid color-mix(in srgb, var(--brand) 22%, transparent);
	background: color-mix(in srgb, var(--brand) 6%, var(--sf));
	animation: llmchat-msg-in 0.2s ease;
}
.llmchat-summary-label {
	display: inline-flex;
	align-items: center;
	gap: 4.8px;
	font-size: 10.88px;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--brand);
}
.llmchat-summary-label-icon {
	width: 12.8px;
	height: 12.8px;
	flex-shrink: 0;
}
.llmchat-summary-body {
	margin: 0;
	font-size: 13.6px;
	line-height: 1.4;
	color: var(--tx-2);
	word-break: break-word;
}

/* ── Privacy consent notice — full-width bar above the composer, until first
   message. Left-aligned text, dismiss × on the right, own top divider. ── */
.llmchat-privacy {
	margin: 0;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 8px 8px 14px;
	background: var(--sf);
	border-top: 1px solid var(--ln);
}
.llmchat-privacy-text {
	margin: 0;
	flex: 1;
	min-width: 0;
	font-size: 11.52px;
	line-height: 1.4;
	text-align: left;
	color: var(--tx-4);
}
.llmchat-privacy a {
	color: var(--brand);
	text-decoration: underline;
	text-underline-offset: 2px;
}
.llmchat-privacy a:hover {
	text-decoration: none;
}
/* Dismiss × — muted to sit on the white bar (the header close is white-on-brand,
   so it can't share that treatment). Hiding the bar never withdraws consent. */
.llmchat-privacy-dismiss {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	padding: 0;
	border: none;
	border-radius: 6px;
	background: transparent;
	color: var(--tx-5);
	cursor: pointer;
	transition:
		background 0.15s ease,
		color 0.15s ease;
}
.llmchat-privacy-dismiss:hover {
	background: var(--sf-2);
	color: var(--tx-3);
}
.llmchat-privacy-dismiss:focus-visible {
	outline: none;
	box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 30%, transparent);
}
.llmchat-privacy-dismiss-icon {
	width: 12.8px;
	height: 12.8px;
}
/* When the notice is present it owns the divider above the composer, so the
   composer drops its own top border to avoid a double line. Once dismissed the
   bar is gone and the composer's own border-top returns — no layout gap. */
.llmchat-privacy + .llmchat-input {
	border-top: none;
}

/* ── Composer ──────────────────────────────────────────────────────── */
.llmchat-input {
	border-top: 1px solid var(--ln);
	padding: 10px 12px;
	display: flex;
	gap: 8px;
	align-items: flex-end;
	background: var(--sf);
	flex-shrink: 0;
}
.llmchat-input textarea {
	max-height: 112px;
}
.llmchat-send {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 38px;
	height: 38px;
	flex-shrink: 0;
	border-radius: 9999px;
	background: var(--brand);
	color: #fff;
	border: none;
	cursor: pointer;
	transition:
		filter 0.15s ease,
		transform 0.1s ease,
		opacity 0.15s ease;
}
.llmchat-send:hover:not(:disabled) {
	filter: brightness(1.08);
}
.llmchat-send:active:not(:disabled) {
	transform: scale(0.92);
}
.llmchat-send:disabled {
	opacity: 0.4;
	cursor: default;
}
.llmchat-send:focus-visible,
.llmchat-escalate button:focus-visible {
	outline: none;
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 30%, transparent);
}

/* ── Quick-reply chips (guided / concierge prompts) ────────────────── */
.llmchat-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	padding: 0 16px 13.6px;
}
.llmchat-chip {
	font: inherit;
	font-size: 13.6px;
	line-height: 1.2;
	padding: 7.2px 13.6px;
	border-radius: 9999px;
	border: 1px solid color-mix(in srgb, var(--brand) 35%, transparent);
	background: color-mix(in srgb, var(--brand) 8%, transparent);
	color: var(--brand);
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	gap: 7.2px;
	transition:
		background 0.15s ease,
		transform 0.1s ease;
}
.llmchat-chip:hover {
	background: color-mix(in srgb, var(--brand) 16%, transparent);
}
.llmchat-chip:active {
	transform: translateY(1px);
}
.llmchat-chip:focus-visible {
	outline: none;
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 30%, transparent);
}
.llmchat-chip-dot {
	width: 13.6px;
	height: 13.6px;
	border-radius: 9999px;
	display: inline-block;
}

@media (prefers-reduced-motion: reduce) {
	.llmchat *,
	.llmchat *::before,
	.llmchat *::after {
		animation: none !important;
		transition: none !important;
	}
}
`;
