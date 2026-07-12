"use client";

import { useEffect, useRef } from "react";

import { Slot } from "./slot";
import { useClankerSupport } from "../client/context";
import { ClankerSupportProvider } from "../client/provider";

import type { ChatMessage } from "../types";
import type { ComponentProps, ReactNode } from "react";

/**
 * Headless primitives. Every component here is UNSTYLED: it renders a plain
 * semantic element with `data-*` state attributes for your CSS, forwards all
 * native props (className, style, refs — React 19 ref-as-prop), and supports
 * `asChild` on interactive elements to render your own component instead.
 *
 * Compose them under `Root`, or skip components entirely and build on the
 * `useClankerSupport()` hook.
 */

/** Default id linking `Trigger` (aria-controls) to `Panel`. Override with the `id` prop on both. */
export const PANEL_ID = "clanker-support-panel";

/** Context provider — alias of `ClankerSupportProvider` for JSX composition. */
export const Root = ClankerSupportProvider;

type ButtonProps = ComponentProps<"button"> & { asChild?: boolean };

/**
 * Opens/closes the panel. Renders a `<button>` with `aria-expanded`,
 * `aria-controls` and `data-state="open" | "closed"`.
 */
export function Trigger({ asChild, id, ...props }: ButtonProps) {
	const { open, toggle } = useClankerSupport();
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			type={asChild ? undefined : "button"}
			aria-expanded={open}
			aria-controls={id ?? PANEL_ID}
			aria-haspopup="dialog"
			data-state={open ? "open" : "closed"}
			onClick={toggle}
			{...props}
		/>
	);
}

/**
 * The chat panel. Unmounted while closed (pass `forceMount` to keep it in the
 * DOM and animate via `data-state`). Focuses itself on open and closes on
 * Escape.
 */
export function Panel({
	forceMount = false,
	id = PANEL_ID,
	children,
	...props
}: ComponentProps<"div"> & { forceMount?: boolean }) {
	const { open, setOpen } = useClankerSupport();
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (open) {
			ref.current?.focus();
		}
	}, [open]);
	if (!open && !forceMount) {
		return null;
	}
	return (
		<div
			ref={ref}
			id={id}
			role="dialog"
			aria-label="Support chat"
			tabIndex={-1}
			data-state={open ? "open" : "closed"}
			hidden={!open && forceMount ? true : undefined}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					e.stopPropagation();
					setOpen(false);
				}
			}}
			{...props}
		>
			{children}
		</div>
	);
}

/**
 * The conversation. With a function child you fully own each row's markup;
 * without one it renders `<div data-part="message" data-role={role}>`.
 * Internal `system` rows are filtered out; auto-scrolls to the newest message.
 */
export function Messages({
	children,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	children?: (message: ChatMessage) => ReactNode;
}) {
	const { messages } = useClankerSupport();
	const ref = useRef<HTMLDivElement>(null);
	const visible = messages.filter(
		(m) => m.role !== "system" && m.content.trim() !== "",
	);
	const lastCount = useRef(0);
	useEffect(() => {
		if (visible.length !== lastCount.current) {
			lastCount.current = visible.length;
			const el = ref.current;
			if (el) {
				el.scrollTop = el.scrollHeight;
			}
		}
	});
	return (
		<div
			ref={ref}
			role="log"
			aria-live="polite"
			data-part="messages"
			{...props}
		>
			{visible.map((m) =>
				children ? (
					<div key={m.id} style={{ display: "contents" }}>
						{children(m)}
					</div>
				) : (
					<div key={m.id} data-part="message" data-role={m.role}>
						<QuotedMessage message={m} />
						{m.content}
					</div>
				),
			)}
		</div>
	);
}

/** `<form>` wired to `send()`. Compose `Input` and `Submit` inside it. */
export function Composer({ onSubmit, ...props }: ComponentProps<"form">) {
	const { send } = useClankerSupport();
	return (
		<form
			data-part="composer"
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit?.(e);
				void send();
			}}
			{...props}
		/>
	);
}

/** Text input bound to the shared composer draft. Typing stays available while a reply streams. */
export function Input(props: ComponentProps<"input">) {
	const { draft, setDraft } = useClankerSupport();
	return (
		<input
			data-part="input"
			aria-label="Message"
			placeholder="Ask a question…"
			autoComplete="off"
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			{...props}
		/>
	);
}

/** Copy for a quote whose target isn't in the loaded thread (older page, or deleted). */
export const MISSING_QUOTE_LABEL = "earlier message";

/**
 * The quote chip rendered above a message that replies to an earlier one. Renders
 * nothing when the message isn't a reply. When the quoted id can't be resolved in
 * the loaded thread — an older page the widget hasn't fetched, or a message that no
 * longer exists — it degrades to a neutral "earlier message" label rather than
 * disappearing, so the reply never looks like it was addressed to nothing.
 */
export function QuotedMessage({
	message,
	children,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	message: ChatMessage;
	children?: (quoted: ChatMessage | null) => ReactNode;
}) {
	const { findMessage } = useClankerSupport();
	if (!message.replyToMessageId) {
		return null;
	}
	const quoted = findMessage(message.replyToMessageId);
	return (
		<div
			data-part="quote"
			data-role={quoted?.role}
			data-resolved={quoted ? "true" : "false"}
			{...props}
		>
			{children ? children(quoted) : (quoted?.content ?? MISSING_QUOTE_LABEL)}
		</div>
	);
}

/**
 * The "Replying to:" bar shown above the composer once the visitor picks a message
 * to reply to. Renders nothing when no reply is pending. The default body is the
 * quoted text plus a dismiss button that clears the pending reply.
 */
export function ReplyingTo({
	children,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	children?: (message: ChatMessage, dismiss: () => void) => ReactNode;
}) {
	const { replyTo, setReplyTo } = useClankerSupport();
	if (!replyTo) {
		return null;
	}
	const dismiss = () => setReplyTo(null);
	return (
		<div data-part="replying-to" data-role={replyTo.role} {...props}>
			{children ? (
				children(replyTo, dismiss)
			) : (
				<>
					<span data-part="replying-to-text">{replyTo.content}</span>
					<button
						type="button"
						data-part="replying-to-dismiss"
						aria-label="Cancel reply"
						onClick={dismiss}
					>
						×
					</button>
				</>
			)}
		</div>
	);
}

/**
 * "Reply" affordance for a specific message — sets it as the pending reply target.
 * Renders nothing for `system` rows (internal markers the widget never shows) so a
 * visitor can only ever quote a message they actually saw. Bring your own label:
 * this is headless, so it sets no aria-label — an ICON-only button needs one from
 * you (a text child labels itself).
 */
export function ReplyButton({
	asChild,
	message,
	...props
}: ButtonProps & { message: ChatMessage }) {
	const { setReplyTo } = useClankerSupport();
	if (message.role === "system") {
		return null;
	}
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			type={asChild ? undefined : "button"}
			data-part="reply-button"
			onClick={() => setReplyTo(message)}
			{...props}
		/>
	);
}

/** Submit button — disabled while a send is in flight or the draft is empty. */
export function Submit({ asChild, disabled, ...props }: ButtonProps) {
	const { draft, status } = useClankerSupport();
	const busy = status === "submitted" || status === "streaming";
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			type={asChild ? undefined : "submit"}
			disabled={disabled || busy || draft.trim() === ""}
			data-state={busy ? "busy" : "idle"}
			{...props}
		/>
	);
}

/**
 * "Talk to a human". Renders nothing until the visitor may escalate
 * (threshold reached, not already escalated/resolved) — the eligibility logic
 * is the SDK's; bring your own copy and styles.
 */
export function EscalateButton({ asChild, ...props }: ButtonProps) {
	const { canEscalate, escalating, escalate } = useClankerSupport();
	if (!canEscalate) {
		return null;
	}
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			type={asChild ? undefined : "button"}
			disabled={escalating}
			data-part="escalate"
			data-state={escalating ? "pending" : "idle"}
			onClick={() => void escalate()}
			{...props}
		/>
	);
}

/** "Mark as resolved". Renders nothing until the conversation can be resolved. */
export function ResolveButton({ asChild, ...props }: ButtonProps) {
	const { canResolve, resolving, resolve } = useClankerSupport();
	if (!canResolve) {
		return null;
	}
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			type={asChild ? undefined : "button"}
			disabled={resolving}
			data-part="resolve"
			data-state={resolving ? "pending" : "idle"}
			onClick={() => void resolve()}
			{...props}
		/>
	);
}

/**
 * Plan-gated "Powered by" attribution. The flag is decided server-side; on
 * free tiers this must render — style it, don't remove it.
 */
export function Branding({ children, ...props }: ComponentProps<"a">) {
	const { showBranding } = useClankerSupport();
	if (!showBranding) {
		return null;
	}
	return (
		<a
			data-part="branding"
			href="https://clankersupport.com/?utm_source=widget&utm_medium=powered_by"
			target="_blank"
			rel="noreferrer"
			{...props}
		>
			{children ?? "Powered by Clanker Support"}
		</a>
	);
}
