/**
 * Styles for the batteries-included widget, exported as a string (injected
 * via a `<style>` tag) so the package needs no CSS-file pipeline in the host
 * app. Everything is scoped under `.clanker-root` and driven by the
 * `--clanker-brand` custom property, so overriding is plain CSS:
 *
 *   .clanker-root { --clanker-brand: #16a34a; }
 *   .clanker-panel { border-radius: 0; }
 *
 * For full control, skip this widget and compose the headless primitives.
 */
export const widgetStyles = `
.clanker-root {
	--clanker-brand: #111827;
	--clanker-surface: #ffffff;
	--clanker-text: #111827;
	--clanker-muted: #6b7280;
	--clanker-border: #e5e7eb;
	--clanker-bubble: #f3f4f6;
	position: fixed;
	bottom: 20px;
	right: 20px;
	z-index: 2147483000;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 12px;
	font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
	font-size: 14px;
	line-height: 1.5;
	color: var(--clanker-text);
}
.clanker-root[data-position="bottom-left"] {
	right: auto;
	left: 20px;
	align-items: flex-start;
}
.clanker-root *,
.clanker-root *::before,
.clanker-root *::after {
	box-sizing: border-box;
}

.clanker-launcher {
	order: 2;
	width: 56px;
	height: 56px;
	border: 0;
	border-radius: 50%;
	background: var(--clanker-brand);
	color: #fff;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
	transition: transform 0.15s ease;
}
.clanker-launcher:hover {
	transform: scale(1.06);
}
.clanker-launcher:focus-visible {
	outline: 2px solid var(--clanker-brand);
	outline-offset: 3px;
}
.clanker-launcher svg {
	width: 26px;
	height: 26px;
}

.clanker-panel {
	order: 1;
	width: min(380px, calc(100vw - 40px));
	height: min(600px, calc(100dvh - 110px));
	display: flex;
	flex-direction: column;
	background: var(--clanker-surface);
	border: 1px solid var(--clanker-border);
	border-radius: 16px;
	box-shadow: 0 24px 64px rgb(0 0 0 / 0.22);
	overflow: hidden;
	outline: none;
	animation: clanker-pop 0.18s ease;
}
@keyframes clanker-pop {
	from {
		opacity: 0;
		transform: translateY(8px) scale(0.98);
	}
	to {
		opacity: 1;
		transform: none;
	}
}
@media (prefers-reduced-motion: reduce) {
	.clanker-panel {
		animation: none;
	}
	.clanker-launcher {
		transition: none;
	}
}

.clanker-header {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 14px 16px;
	background: var(--clanker-brand);
	color: #fff;
}
.clanker-header-title {
	font-weight: 600;
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.clanker-header-avatar {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	background: rgb(255 255 255 / 0.2);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: none;
}
.clanker-header-avatar svg {
	width: 16px;
	height: 16px;
}
.clanker-close {
	border: 0;
	background: transparent;
	color: inherit;
	cursor: pointer;
	padding: 4px;
	border-radius: 6px;
	display: inline-flex;
}
.clanker-close:hover {
	background: rgb(255 255 255 / 0.15);
}
.clanker-close svg {
	width: 18px;
	height: 18px;
}

.clanker-messages {
	flex: 1;
	overflow-y: auto;
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	overscroll-behavior: contain;
}
.clanker-msg {
	position: relative;
	max-width: 85%;
	padding: 9px 13px;
	border-radius: 14px;
	white-space: pre-wrap;
	overflow-wrap: break-word;
}

/* Quote-reply: the chip above a bubble that replies to an earlier message. */
.clanker-quote {
	display: flex;
	flex-direction: column;
	gap: 1px;
	max-width: 85%;
	padding: 5px 10px;
	border-left: 2px solid var(--clanker-brand);
	border-radius: 6px;
	background: var(--clanker-bubble);
	font-size: 11px;
	line-height: 1.35;
	margin-bottom: -6px;
}
.clanker-quote[data-role="user"] {
	align-self: flex-end;
}
.clanker-quote[data-role="assistant"],
.clanker-quote[data-role="admin"],
/* Unresolved (older page / deleted) — no role to align by; keep it with the reply. */
.clanker-quote[data-resolved="false"] {
	align-self: flex-start;
}
.clanker-quote-author {
	color: var(--clanker-brand);
	font-weight: 600;
}
.clanker-quote-text {
	color: var(--clanker-muted);
	/* One line: the chip identifies the target, the thread shows the full text. */
	display: -webkit-box;
	-webkit-line-clamp: 1;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
.clanker-quote[data-resolved="false"] .clanker-quote-text {
	font-style: italic;
}

/* Reply affordance — revealed on hover, and always visible on touch (no hover). */
.clanker-reply {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
	border: 0;
	background: transparent;
	color: var(--clanker-muted);
	cursor: pointer;
	padding: 2px 4px;
	font-size: 12px;
	line-height: 1;
	opacity: 0;
	transition: opacity 120ms ease;
}
.clanker-msg[data-role="user"] .clanker-reply {
	left: -22px;
}
.clanker-msg[data-role="assistant"] .clanker-reply,
.clanker-msg[data-role="admin"] .clanker-reply {
	right: -22px;
}
.clanker-msg:hover .clanker-reply,
.clanker-reply:focus-visible {
	opacity: 1;
}
@media (hover: none) {
	.clanker-reply {
		opacity: 0.6;
	}
}

/* "Replying to:" bar above the composer. */
.clanker-replying {
	display: flex;
	align-items: center;
	gap: 6px;
	margin: 0 12px;
	padding: 6px 10px;
	border-left: 2px solid var(--clanker-brand);
	border-radius: 6px;
	background: var(--clanker-bubble);
	font-size: 11px;
	line-height: 1.35;
}
.clanker-replying-label {
	color: var(--clanker-brand);
	font-weight: 600;
	white-space: nowrap;
}
.clanker-replying-text {
	flex: 1;
	min-width: 0;
	color: var(--clanker-muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.clanker-replying-dismiss {
	border: 0;
	background: transparent;
	color: var(--clanker-muted);
	cursor: pointer;
	font-size: 14px;
	line-height: 1;
	padding: 0 2px;
}
.clanker-replying-dismiss:hover {
	color: var(--clanker-text);
}
.clanker-msg[data-role="user"] {
	align-self: flex-end;
	background: var(--clanker-brand);
	color: #fff;
	border-bottom-right-radius: 4px;
}
.clanker-msg[data-role="assistant"],
.clanker-msg[data-role="admin"] {
	align-self: flex-start;
	background: var(--clanker-bubble);
	border-bottom-left-radius: 4px;
}
.clanker-msg-meta {
	font-size: 11px;
	color: var(--clanker-muted);
	margin: -4px 0 0 4px;
	align-self: flex-start;
}
.clanker-rating {
	display: flex;
	gap: 4px;
	align-self: flex-start;
	margin: -4px 0 0 4px;
}
.clanker-rating button {
	border: 0;
	background: transparent;
	cursor: pointer;
	padding: 2px 4px;
	border-radius: 6px;
	font-size: 12px;
	color: var(--clanker-muted);
	line-height: 1;
}
.clanker-rating button:hover {
	background: var(--clanker-bubble);
}
.clanker-rating button[data-active="true"] {
	color: var(--clanker-brand);
	background: var(--clanker-bubble);
}

.clanker-typing {
	align-self: flex-start;
	display: inline-flex;
	gap: 4px;
	padding: 12px 14px;
	background: var(--clanker-bubble);
	border-radius: 14px;
	border-bottom-left-radius: 4px;
}
.clanker-typing span {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--clanker-muted);
	animation: clanker-blink 1.2s infinite both;
}
.clanker-typing span:nth-child(2) {
	animation-delay: 0.15s;
}
.clanker-typing span:nth-child(3) {
	animation-delay: 0.3s;
}
@keyframes clanker-blink {
	0%,
	80%,
	100% {
		opacity: 0.25;
	}
	40% {
		opacity: 1;
	}
}

.clanker-notice {
	margin: 0 16px 10px;
	padding: 10px 12px;
	border-radius: 10px;
	background: var(--clanker-bubble);
	color: var(--clanker-muted);
	font-size: 13px;
}
.clanker-notice strong {
	color: var(--clanker-text);
}
.clanker-error {
	margin: 0 16px 10px;
	color: #b91c1c;
	font-size: 13px;
}
.clanker-privacy {
	margin: 0 16px 8px;
	font-size: 12px;
	color: var(--clanker-muted);
}
.clanker-privacy a {
	color: inherit;
	text-decoration: underline;
}

.clanker-actions {
	display: flex;
	gap: 8px;
	margin: 0 16px 10px;
	flex-wrap: wrap;
}
.clanker-actions button {
	border: 1px solid var(--clanker-border);
	background: var(--clanker-surface);
	color: var(--clanker-text);
	border-radius: 999px;
	padding: 6px 14px;
	font-size: 13px;
	cursor: pointer;
}
.clanker-actions button:hover {
	border-color: var(--clanker-brand);
	color: var(--clanker-brand);
}
.clanker-actions button:disabled {
	opacity: 0.6;
	cursor: default;
}

.clanker-composer {
	display: flex;
	gap: 8px;
	padding: 12px 16px;
	border-top: 1px solid var(--clanker-border);
}
.clanker-input {
	flex: 1;
	min-width: 0;
	border: 1px solid var(--clanker-border);
	border-radius: 10px;
	padding: 9px 12px;
	font: inherit;
	color: inherit;
	background: var(--clanker-surface);
}
.clanker-input:focus-visible {
	outline: 2px solid var(--clanker-brand);
	outline-offset: -1px;
}
.clanker-send {
	border: 0;
	border-radius: 10px;
	background: var(--clanker-brand);
	color: #fff;
	width: 40px;
	flex: none;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
}
.clanker-send:disabled {
	opacity: 0.5;
	cursor: default;
}
.clanker-send svg {
	width: 18px;
	height: 18px;
}

.clanker-identity {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 20px 16px;
}
.clanker-identity h3 {
	margin: 0;
	font-size: 15px;
}
.clanker-identity p {
	margin: 0 0 6px;
	color: var(--clanker-muted);
	font-size: 13px;
}
.clanker-identity input {
	border: 1px solid var(--clanker-border);
	border-radius: 10px;
	padding: 9px 12px;
	font: inherit;
}
.clanker-identity input:focus-visible {
	outline: 2px solid var(--clanker-brand);
	outline-offset: -1px;
}
.clanker-identity button {
	margin-top: 4px;
	border: 0;
	border-radius: 10px;
	background: var(--clanker-brand);
	color: #fff;
	padding: 10px 14px;
	font: inherit;
	font-weight: 600;
	cursor: pointer;
}

.clanker-csat {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 14px;
	padding: 24px 16px;
	text-align: center;
}
.clanker-csat p {
	margin: 0;
	font-weight: 600;
}
.clanker-csat-scale {
	display: flex;
	gap: 6px;
}
.clanker-csat-scale button {
	width: 40px;
	height: 40px;
	border-radius: 10px;
	border: 1px solid var(--clanker-border);
	background: var(--clanker-surface);
	font: inherit;
	cursor: pointer;
}
.clanker-csat-scale button:hover {
	border-color: var(--clanker-brand);
	color: var(--clanker-brand);
}
.clanker-csat-skip {
	border: 0;
	background: transparent;
	color: var(--clanker-muted);
	font-size: 13px;
	cursor: pointer;
	text-decoration: underline;
}

.clanker-footer {
	display: flex;
	justify-content: center;
	padding: 6px 0 10px;
}
.clanker-footer a {
	font-size: 11px;
	color: var(--clanker-muted);
	text-decoration: none;
}
.clanker-footer a:hover {
	text-decoration: underline;
}
`;
