"use client";

import { useState } from "react";

import { widgetStyles } from "./styles";
import { useClankerSupport } from "../client/context";
import { ClankerSupportProvider } from "../client/provider";
import {
	Branding,
	Composer,
	EscalateButton,
	Input,
	Messages,
	Panel,
	ResolveButton,
	Submit,
	Trigger,
} from "../primitives/primitives";

import type { ClankerSupportProviderProps } from "../client/provider";
import type { CSSProperties } from "react";

/** How long the "Thanks!" screen shows before the panel closes. */
const CSAT_THANKS_MS = 1200;
const DEFAULT_PRIVACY_URL = "https://clankersupport.com/privacy-policy";

export interface ClankerSupportWidgetProps extends Omit<
	ClankerSupportProviderProps,
	"children"
> {
	/** Panel header title. Default "Support". */
	title?: string;
	/** Extra class on the fixed-position container (e.g. to re-theme via CSS vars). */
	className?: string;
}

/**
 * The batteries-included widget: floating launcher + chat panel, styled and
 * ready. It's built entirely from the headless primitives in
 * `@clankersupport/widget-rsc/headless` — use it as-is, restyle it with CSS
 * (everything is `.clanker-*` + `--clanker-brand`), or fork the composition.
 *
 * This is a client component. In a Server Component tree (Next.js root
 * layout), prefer `ClankerSupport` from the package root, which also
 * prefetches the widget config server-side.
 */
export function ClankerSupportWidget({
	title = "Support",
	className,
	...providerProps
}: ClankerSupportWidgetProps) {
	return (
		<ClankerSupportProvider {...providerProps}>
			<WidgetShell title={title} className={className} />
		</ClankerSupportProvider>
	);
}

function ChatIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9l-4.2 3.36A1 1 0 0 1 3 18.58V6Z"
				fill="currentColor"
			/>
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M6 6l12 12M18 6L6 18"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function SendIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M4 12 20 4l-4 8 4 8-16-8Z"
				fill="currentColor"
				fillRule="evenodd"
			/>
		</svg>
	);
}

function WidgetShell({
	title,
	className,
}: {
	title: string;
	className?: string;
}) {
	const { open, setOpen, brandColor, position, csatEligible, submitCsat } =
		useClankerSupport();
	// CSAT closing screen: "hidden" during chat, "prompt" on close (when
	// eligible), "thanks" briefly after a rating. A second close never traps.
	const [csatStep, setCsatStep] = useState<"hidden" | "prompt" | "thanks">(
		"hidden",
	);

	function handleClose() {
		if (csatStep === "hidden" && csatEligible) {
			setCsatStep("prompt");
			return;
		}
		setCsatStep("hidden");
		setOpen(false);
	}

	function handleCsat(rating: number) {
		void submitCsat(rating);
		setCsatStep("thanks");
		setTimeout(() => {
			setCsatStep("hidden");
			setOpen(false);
		}, CSAT_THANKS_MS);
	}

	return (
		<div
			className={["clanker-root", className].filter(Boolean).join(" ")}
			data-position={position}
			style={{ "--clanker-brand": brandColor } as CSSProperties}
		>
			<style>{widgetStyles}</style>
			<Trigger
				className="clanker-launcher"
				aria-label={open ? "Close chat" : "Open chat"}
			>
				{open ? <CloseIcon /> : <ChatIcon />}
			</Trigger>
			<Panel className="clanker-panel">
				<header className="clanker-header">
					<span className="clanker-header-avatar">
						<ChatIcon />
					</span>
					<span className="clanker-header-title">{title}</span>
					<button
						type="button"
						className="clanker-close"
						onClick={handleClose}
						aria-label="Close chat"
					>
						<CloseIcon />
					</button>
				</header>
				{csatStep !== "hidden" ? (
					<CsatStep step={csatStep} onRate={handleCsat} onSkip={handleClose} />
				) : (
					<Conversation />
				)}
				<div className="clanker-footer">
					<Branding />
				</div>
			</Panel>
		</div>
	);
}

function Conversation() {
	const {
		identity,
		greeting,
		status,
		errorMessage,
		escalated,
		escalating,
		escalateFailed,
		resolved,
		escalationSummary,
		privacyPolicyUrl,
		conversationId,
		messages,
		rate,
	} = useClankerSupport();

	if (!identity) {
		return <IdentityStep />;
	}

	const userMessageCount = messages.filter((m) => m.role === "user").length;

	return (
		<>
			{greeting !== null && <GreetingBubble greeting={greeting} />}
			<Messages className="clanker-messages">
				{(m) => (
					<>
						{m.role === "admin" && (
							<span className="clanker-msg-meta">Support team</span>
						)}
						<div className="clanker-msg" data-role={m.role}>
							{m.content}
						</div>
						{m.rateable && conversationId ? (
							<span className="clanker-rating">
								<button
									type="button"
									aria-label="Good answer"
									data-active={m.rating === "up"}
									onClick={() => void rate(m.id, "up")}
								>
									👍
								</button>
								<button
									type="button"
									aria-label="Bad answer"
									data-active={m.rating === "down"}
									onClick={() => void rate(m.id, "down")}
								>
									👎
								</button>
							</span>
						) : null}
					</>
				)}
			</Messages>
			{status === "submitted" && (
				<span className="clanker-typing" aria-label="Assistant is typing">
					<span />
					<span />
					<span />
				</span>
			)}
			{errorMessage && <p className="clanker-error">{errorMessage}</p>}
			<div className="clanker-actions">
				<EscalateButton>
					{escalating ? "Contacting the team…" : "Talk to a human"}
				</EscalateButton>
				<ResolveButton>Mark as resolved</ResolveButton>
			</div>
			{escalateFailed && (
				<p className="clanker-error">
					Could not reach the team. Please try again.
				</p>
			)}
			{resolved ? (
				<p className="clanker-notice">
					<strong>Resolved.</strong> This conversation is closed — send a new
					message any time to reopen the chat.
				</p>
			) : escalated ? (
				<p className="clanker-notice">
					<strong>The team has been notified.</strong>{" "}
					{escalationSummary ??
						"A human will follow up here — feel free to add more details."}
				</p>
			) : null}
			{userMessageCount === 0 && (
				<p className="clanker-privacy">
					By chatting, you agree to our{" "}
					<a
						href={privacyPolicyUrl ?? DEFAULT_PRIVACY_URL}
						target="_blank"
						rel="noreferrer"
					>
						privacy policy
					</a>
					.
				</p>
			)}
			<Composer className="clanker-composer">
				<Input className="clanker-input" />
				<Submit className="clanker-send" aria-label="Send message">
					<SendIcon />
				</Submit>
			</Composer>
		</>
	);
}

/**
 * The greeting renders OUTSIDE `Messages` (it's local-only copy, not a
 * conversation row) but is styled like an assistant bubble, pinned above the
 * scrolling conversation.
 */
function GreetingBubble({ greeting }: { greeting: string }) {
	return (
		<div
			className="clanker-messages"
			style={{ flex: "none", paddingBottom: 0 }}
		>
			<div className="clanker-msg" data-role="assistant">
				{greeting}
			</div>
		</div>
	);
}

function IdentityStep() {
	const { identify } = useClankerSupport();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	return (
		<form
			className="clanker-identity"
			onSubmit={(e) => {
				e.preventDefault();
				identify({ name, email });
			}}
		>
			<h3>Before we start</h3>
			<p>Tell us who you are so the team can follow up if needed.</p>
			<input
				aria-label="Your name"
				placeholder="Your name"
				required
				value={name}
				onChange={(e) => setName(e.target.value)}
			/>
			<input
				aria-label="Email (optional)"
				placeholder="Email (optional)"
				type="email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
			/>
			<button type="submit">Start chatting</button>
		</form>
	);
}

function CsatStep({
	step,
	onRate,
	onSkip,
}: {
	step: "prompt" | "thanks";
	onRate: (rating: number) => void;
	onSkip: () => void;
}) {
	if (step === "thanks") {
		return (
			<div className="clanker-csat">
				<p>Thanks for the feedback!</p>
			</div>
		);
	}
	return (
		<div className="clanker-csat">
			<p>How was this conversation?</p>
			<div className="clanker-csat-scale">
				{[1, 2, 3, 4, 5].map((n) => (
					<button
						key={n}
						type="button"
						aria-label={`Rate ${n} out of 5`}
						onClick={() => onRate(n)}
					>
						{n}
					</button>
				))}
			</div>
			<button type="button" className="clanker-csat-skip" onClick={onSkip}>
				Skip
			</button>
		</div>
	);
}
