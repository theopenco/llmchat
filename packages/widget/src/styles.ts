// Source of truth for the widget's shadow-DOM stylesheet. Exported as a
// string so it can be consumed from both Vite (IIFE bundle) and Next.js
// (server-rendered host page) without bundler-specific `?inline` syntax.
export const widgetStyles = `
:host,
.llmchat {
	font-family:
		system-ui,
		-apple-system,
		Segoe UI,
		sans-serif;
	color: #111827;
	/* Pin inherited properties so the host page's typography can't leak across
	   the shadow boundary and distort the widget. */
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
	bottom: 1.25rem;
	right: 1.25rem;
	width: 3.5rem;
	height: 3.5rem;
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

/* ── Panel ─────────────────────────────────────────────────────────── */
.llmchat-panel {
	position: fixed;
	bottom: 5.5rem;
	right: 1.25rem;
	width: 23rem;
	max-width: calc(100vw - 2rem);
	height: 34rem;
	max-height: calc(100vh - 7rem);
	background: #fff;
	border-radius: 1rem;
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
	padding: 0.875rem 1rem;
	display: flex;
	align-items: center;
	gap: 0.5rem;
	flex-shrink: 0;
}
.llmchat-header-id {
	display: flex;
	align-items: center;
	gap: 0.625rem;
	min-width: 0;
}
.llmchat-header-avatar {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 2rem;
	height: 2rem;
	border-radius: 9999px;
	background: rgba(255, 255, 255, 0.22);
	flex-shrink: 0;
}
.llmchat-header-avatar svg {
	width: 1.05rem;
	height: 1.05rem;
}
.llmchat-header-text {
	font-weight: 600;
	font-size: 0.95rem;
	letter-spacing: 0.01em;
}
.llmchat-icon-btn {
	margin-left: auto;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 2rem;
	height: 2rem;
	border-radius: 0.5rem;
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
	padding: 1.5rem 1.25rem;
	display: flex;
	flex-direction: column;
	gap: 1rem;
}
.llmchat-identify-intro {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}
.llmchat-identify-title {
	margin: 0;
	font-size: 1.15rem;
	font-weight: 700;
}
.llmchat-identify-sub {
	margin: 0;
	font-size: 0.875rem;
	color: #6b7280;
}
.llmchat-field {
	display: flex;
	flex-direction: column;
	gap: 0.3rem;
}
.llmchat-field-label {
	font-size: 0.78rem;
	font-weight: 600;
	color: #6b7280;
}
.llmchat-identify input,
.llmchat-input textarea {
	width: 100%;
	border: 1px solid #d1d5db;
	border-radius: 0.625rem;
	padding: 0.55rem 0.75rem;
	font: inherit;
	font-size: 0.9rem;
	color: #111827;
	background: #fff;
	resize: none;
	transition:
		border-color 0.15s ease,
		box-shadow 0.15s ease;
}
.llmchat-identify input::placeholder,
.llmchat-input textarea::placeholder {
	color: #9ca3af;
}
.llmchat-identify input:focus,
.llmchat-input textarea:focus {
	outline: none;
	border-color: var(--brand);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent);
}
.llmchat-identify button {
	margin-top: 0.25rem;
	background: var(--brand);
	color: #fff;
	border: none;
	border-radius: 0.625rem;
	padding: 0.6rem 0.75rem;
	font: inherit;
	font-size: 0.9rem;
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
	padding: 1rem 0.875rem;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	background: #fff;
	scrollbar-width: thin;
	scrollbar-color: #d1d5db transparent;
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
	background: #d1d5db;
	border-radius: 9999px;
	border: 2px solid #fff;
}
/* "Scroll to latest": sticky so it floats at the bottom of the scroll area
   while the visitor reads earlier messages during a streaming reply. */
.llmchat-jump {
	position: sticky;
	bottom: 0.25rem;
	align-self: center;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 2rem;
	height: 2rem;
	margin-top: 0.25rem;
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
	padding: 0.5rem 0.75rem;
	border-radius: 1rem;
	font-size: 0.9rem;
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
	background: #f3f4f6;
	color: #111827;
	align-self: flex-start;
	border-bottom-left-radius: 0.25rem;
}
.llmchat-msg-user {
	background: var(--brand);
	color: #fff;
	align-self: flex-end;
	border-bottom-right-radius: 0.25rem;
}
.llmchat-msg-admin {
	background: #ecfdf5;
	color: #065f46;
	align-self: flex-start;
	border: 1px solid #a7f3d0;
	border-bottom-left-radius: 0.25rem;
}
.llmchat-msg-system {
	align-self: center;
	background: #f3f4f6;
	color: #6b7280;
	font-size: 0.78rem;
	border-radius: 9999px;
	padding: 0.25rem 0.75rem;
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
	margin: 0 0 0.5rem;
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
	margin: 0 0 0.5rem;
	padding-left: 1.25rem;
}
.llmchat-md li {
	margin: 0.15rem 0;
}
.llmchat-md li::marker {
	color: #9ca3af;
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
	margin: 0.6rem 0 0.35rem;
	font-weight: 600;
	line-height: 1.25;
}
.llmchat-md h1 {
	font-size: 1.1rem;
}
.llmchat-md h2 {
	font-size: 1.05rem;
}
.llmchat-md h3 {
	font-size: 1rem;
}
.llmchat-md h4 {
	font-size: 0.95rem;
}
.llmchat-md code {
	font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	font-size: 0.85em;
	background: rgba(0, 0, 0, 0.06);
	padding: 0.1em 0.32em;
	border-radius: 0.3rem;
}
.llmchat-md pre {
	margin: 0 0 0.5rem;
	padding: 0.6rem 0.7rem;
	background: rgba(0, 0, 0, 0.05);
	border-radius: 0.5rem;
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
	margin: 0 0 0.5rem;
	padding-left: 0.7rem;
	border-left: 3px solid rgba(0, 0, 0, 0.12);
	opacity: 0.85;
}
.llmchat-md hr {
	border: none;
	border-top: 1px solid rgba(0, 0, 0, 0.1);
	margin: 0.6rem 0;
}
.llmchat-md table {
	border-collapse: collapse;
	width: 100%;
	margin: 0 0 0.5rem;
	font-size: 0.85em;
}
.llmchat-md th,
.llmchat-md td {
	border: 1px solid rgba(0, 0, 0, 0.12);
	padding: 0.3rem 0.45rem;
	text-align: left;
}
.llmchat-md th {
	font-weight: 600;
	background: rgba(0, 0, 0, 0.04);
}
.llmchat-md img {
	max-width: 100%;
	height: auto;
	border-radius: 0.4rem;
}

/* ── Per-message rating (assistant thumbs) ─────────────────────────── */
/* Group an assistant bubble with its rating controls so they read as one
   left-aligned unit. */
.llmchat-msg-group {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	align-self: flex-start;
	gap: 0.25rem;
	max-width: 85%;
}
.llmchat-msg-group .llmchat-msg {
	max-width: 100%;
}
.llmchat-rate {
	display: flex;
	gap: 0.125rem;
	padding-left: 0.125rem;
}
.llmchat-rate-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.625rem;
	height: 1.625rem;
	border-radius: 0.375rem;
	background: transparent;
	border: none;
	color: #9ca3af;
	cursor: pointer;
	transition:
		background 0.15s ease,
		color 0.15s ease;
}
.llmchat-rate-btn:hover {
	background: #f3f4f6;
	color: #4b5563;
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
	color: #4b5563;
	background: #e5e7eb;
}
.llmchat-rate-btn:focus-visible {
	outline: none;
	box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 30%, transparent);
}
.llmchat-rate-btn svg {
	width: 0.875rem;
	height: 0.875rem;
}

/* ── CSAT closing screen ───────────────────────────────────────────── */
.llmchat-csat {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 1rem;
	padding: 2rem 1.5rem;
	text-align: center;
}
.llmchat-csat-title {
	margin: 0;
	font-size: 1.05rem;
	font-weight: 600;
	color: #111827;
}
.llmchat-csat-stars {
	display: flex;
	gap: 0.25rem;
}
.llmchat-csat-star {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0.25rem;
	background: transparent;
	border: none;
	color: #f59e0b;
	cursor: pointer;
	border-radius: 0.5rem;
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
	color: #6b7280;
	font: inherit;
	font-size: 0.85rem;
	cursor: pointer;
	padding: 0.25rem 0.5rem;
	border-radius: 0.375rem;
}
.llmchat-csat-skip:hover {
	color: #111827;
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
	gap: 0.25rem;
	width: fit-content;
}
.llmchat-dot {
	width: 0.4rem;
	height: 0.4rem;
	border-radius: 9999px;
	background: #9ca3af;
	animation: llmchat-bounce 1.2s infinite ease-in-out;
}
.llmchat-dot:nth-child(2) {
	animation-delay: 0.15s;
}
.llmchat-dot:nth-child(3) {
	animation-delay: 0.3s;
}
@keyframes llmchat-bounce {
	0%,
	60%,
	100% {
		transform: translateY(0);
		opacity: 0.5;
	}
	30% {
		transform: translateY(-0.25rem);
		opacity: 1;
	}
}

.llmchat-demo-badge {
	margin-left: auto;
	background: rgba(255, 255, 255, 0.22);
	color: #fff;
	font-size: 0.7rem;
	font-weight: 600;
	letter-spacing: 0.03em;
	text-transform: uppercase;
	border-radius: 9999px;
	padding: 0.15rem 0.5rem;
}
/* When the demo badge is present the close button shouldn't also push right. */
.llmchat-demo-badge + .llmchat-icon-btn {
	margin-left: 0.25rem;
}
.llmchat-demo-note {
	background: #eef2ff;
	color: #4338ca;
	font-size: 0.78rem;
	padding: 0.5rem 0.875rem;
	border-bottom: 1px solid #e0e7ff;
}
/* "Powered by Clanker Support" attribution at the foot of the panel (plan-gated). */
.llmchat-powered-by {
	display: block;
	text-align: center;
	padding: 0.4rem 0.875rem 0.55rem;
	font-size: 0.7rem;
	color: #9ca3af;
	text-decoration: none;
	border-top: 1px solid #f1f5f9;
	background: #fff;
}
.llmchat-powered-by:hover {
	color: #6b7280;
}
.llmchat-powered-by-name {
	font-weight: 600;
	color: #6b7280;
}
.llmchat-error {
	color: #b91c1c;
	font-size: 0.85rem;
	margin: 0;
	padding: 0.25rem 0.5rem 0;
}

/* ── Escalation ────────────────────────────────────────────────────── */
.llmchat-escalate,
.llmchat-escalated {
	padding: 0.625rem 0.875rem;
	border-top: 1px solid #e5e7eb;
	font-size: 0.85rem;
	flex-shrink: 0;
}
.llmchat-escalate button {
	display: inline-flex;
	align-items: center;
	gap: 0.4rem;
	background: transparent;
	color: var(--brand);
	border: 1px solid color-mix(in srgb, var(--brand) 35%, transparent);
	border-radius: 0.5rem;
	padding: 0.4rem 0.75rem;
	font: inherit;
	font-size: 0.85rem;
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
	color: #4b5563;
	background: #f9fafb;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}
.llmchat-escalated-notice {
	margin: 0;
}

/* ── Escalation handoff summary card ───────────────────────────────── */
/* A one-time recap shown after escalation — not a chat bubble. Brand-tinted so
   it stands off the gray band; body uses neutral ink so it stays readable for
   any brand hue. Rendered only when the server returned a non-empty summary. */
.llmchat-summary {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	padding: 0.5rem 0.625rem;
	border-radius: 0.625rem;
	border: 1px solid color-mix(in srgb, var(--brand) 22%, transparent);
	background: color-mix(in srgb, var(--brand) 6%, #fff);
	animation: llmchat-msg-in 0.2s ease;
}
.llmchat-summary-label {
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	font-size: 0.68rem;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--brand);
}
.llmchat-summary-label-icon {
	width: 0.8rem;
	height: 0.8rem;
	flex-shrink: 0;
}
.llmchat-summary-body {
	margin: 0;
	font-size: 0.85rem;
	line-height: 1.4;
	color: #374151;
	word-break: break-word;
}

/* ── Privacy consent notice — full-width bar above the composer, until first
   message. Left-aligned text, dismiss × on the right, own top divider. ── */
.llmchat-privacy {
	margin: 0;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem 0.5rem 0.5rem 0.875rem;
	background: #fff;
	border-top: 1px solid #e5e7eb;
}
.llmchat-privacy-text {
	margin: 0;
	flex: 1;
	min-width: 0;
	font-size: 0.72rem;
	line-height: 1.4;
	text-align: left;
	color: #6b7280;
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
	width: 1.5rem;
	height: 1.5rem;
	padding: 0;
	border: none;
	border-radius: 0.375rem;
	background: transparent;
	color: #9ca3af;
	cursor: pointer;
	transition:
		background 0.15s ease,
		color 0.15s ease;
}
.llmchat-privacy-dismiss:hover {
	background: #f3f4f6;
	color: #4b5563;
}
.llmchat-privacy-dismiss:focus-visible {
	outline: none;
	box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 30%, transparent);
}
.llmchat-privacy-dismiss-icon {
	width: 0.8rem;
	height: 0.8rem;
}
/* When the notice is present it owns the divider above the composer, so the
   composer drops its own top border to avoid a double line. Once dismissed the
   bar is gone and the composer's own border-top returns — no layout gap. */
.llmchat-privacy + .llmchat-input {
	border-top: none;
}

/* ── Composer ──────────────────────────────────────────────────────── */
.llmchat-input {
	border-top: 1px solid #e5e7eb;
	padding: 0.625rem 0.75rem;
	display: flex;
	gap: 0.5rem;
	align-items: flex-end;
	background: #fff;
	flex-shrink: 0;
}
.llmchat-input textarea {
	max-height: 7rem;
}
.llmchat-send {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 2.375rem;
	height: 2.375rem;
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
	gap: 0.5rem;
	padding: 0 1rem 0.85rem;
}
.llmchat-chip {
	font: inherit;
	font-size: 0.85rem;
	line-height: 1.2;
	padding: 0.45rem 0.85rem;
	border-radius: 9999px;
	border: 1px solid color-mix(in srgb, var(--brand) 35%, transparent);
	background: color-mix(in srgb, var(--brand) 8%, transparent);
	color: var(--brand);
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	gap: 0.45rem;
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
	width: 0.85rem;
	height: 0.85rem;
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
