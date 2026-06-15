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
}

.llmchat-bubble {
	position: fixed;
	bottom: 1rem;
	right: 1rem;
	width: 3rem;
	height: 3rem;
	border-radius: 9999px;
	background: var(--brand);
	color: #fff;
	border: none;
	cursor: pointer;
	box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
	font-size: 1.25rem;
	z-index: 2147483646;
}

.llmchat-panel {
	position: fixed;
	bottom: 5rem;
	right: 1rem;
	width: 22rem;
	height: 32rem;
	background: #fff;
	border-radius: 0.75rem;
	display: flex;
	flex-direction: column;
	box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
	overflow: hidden;
	z-index: 2147483647;
}

/* Inline mode: the panel fills its container — the whole viewport on the
   /embed iframe page (no positioned ancestor), or a position:relative
   wrapper when mounted in-page (e.g. the showcase demo). */
.llmchat-panel-inline {
	position: absolute;
	inset: 0;
	width: auto;
	height: auto;
	border-radius: 0;
	box-shadow: none;
}

.llmchat-header {
	background: var(--brand);
	color: #fff;
	padding: 0.75rem 1rem;
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-weight: 600;
}
.llmchat-header button {
	background: none;
	border: none;
	color: #fff;
	font-size: 1.25rem;
	cursor: pointer;
}

.llmchat-identify {
	padding: 1.5rem;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}
.llmchat-identify input,
.llmchat-input textarea {
	border: 1px solid #d1d5db;
	border-radius: 0.5rem;
	padding: 0.5rem 0.75rem;
	font: inherit;
	resize: none;
	flex: 1;
}
.llmchat-identify button,
.llmchat-input button {
	background: var(--brand);
	color: #fff;
	border: none;
	border-radius: 0.5rem;
	padding: 0.5rem 0.75rem;
	font: inherit;
	cursor: pointer;
}
.llmchat-identify button:disabled,
.llmchat-input button:disabled {
	opacity: 0.5;
}

.llmchat-messages {
	flex: 1;
	overflow-y: auto;
	padding: 0.75rem;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}
.llmchat-msg {
	max-width: 85%;
	padding: 0.5rem 0.75rem;
	border-radius: 1rem;
	font-size: 0.9rem;
	line-height: 1.4;
	white-space: pre-wrap;
	word-break: break-word;
}
.llmchat-msg-assistant {
	background: #f3f4f6;
	align-self: flex-start;
}
.llmchat-msg-user {
	background: var(--brand);
	color: #fff;
	align-self: flex-end;
}
.llmchat-msg-admin {
	background: #ecfdf5;
	align-self: flex-start;
	border: 1px solid #a7f3d0;
}
.llmchat-msg-system {
	align-self: center;
	background: #f3f4f6;
	color: #6b7280;
	font-size: 0.78rem;
	border-radius: 9999px;
	padding: 0.25rem 0.75rem;
}
.llmchat-demo-badge {
	margin-left: auto;
	margin-right: 0.5rem;
	background: rgba(255, 255, 255, 0.25);
	color: #fff;
	font-size: 0.7rem;
	font-weight: 600;
	letter-spacing: 0.03em;
	text-transform: uppercase;
	border-radius: 9999px;
	padding: 0.15rem 0.5rem;
}
.llmchat-demo-note {
	background: #eef2ff;
	color: #4338ca;
	font-size: 0.78rem;
	padding: 0.5rem 0.75rem;
	border-bottom: 1px solid #e0e7ff;
}
.llmchat-typing {
	color: #9ca3af;
	font-size: 0.9rem;
	padding-left: 0.5rem;
}
.llmchat-error {
	color: #b91c1c;
	font-size: 0.85rem;
	margin: 0;
	padding: 0.25rem 0.5rem 0;
}

.llmchat-escalate,
.llmchat-escalated {
	padding: 0.5rem 0.75rem;
	border-top: 1px solid #e5e7eb;
	font-size: 0.85rem;
}
.llmchat-escalate button {
	background: var(--brand);
	color: #fff;
	border: none;
	border-radius: 0.375rem;
	padding: 0.4rem 0.75rem;
	cursor: pointer;
}

.llmchat-input {
	border-top: 1px solid #e5e7eb;
	padding: 0.5rem;
	display: flex;
	gap: 0.5rem;
	align-items: flex-end;
}
`;
