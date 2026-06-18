"use client";

import { useEffect, useRef, useState } from "react";

import {
	Composer,
	MessageList,
	WidgetFrame,
	type DisplayMessage,
} from "@llmchat/widget/chat";

import {
	applyAnswer,
	botPrompt,
	BRAND_CHOICES,
	CONCIERGE_INTRO,
	DEFAULT_BRAND,
	emptyDraft,
	nextStep,
	type BotDraft,
	type StepId,
	validateAnswer,
	welcomePrefill,
} from "./concierge-script";

/** Pause before the bot "answers", so the exchange feels alive (not instant). */
const BOT_DELAY_MS = 450;

type Phase = StepId | "done";

/**
 * The scripted concierge rendered in the real widget chat UI. The user sets up
 * their project by answering — each reply maps to a project field (see
 * concierge-script). When the interview finishes, `onComplete` fires with the
 * collected draft; the page then provisions the real project.
 */
export function ConciergeChat({
	onComplete,
	busy,
}: {
	onComplete: (draft: BotDraft) => void;
	/** Provisioning in flight after the interview — locks input, shows typing. */
	busy: boolean;
}) {
	const [draft, setDraft] = useState<BotDraft>(emptyDraft);
	const [phase, setPhase] = useState<Phase>("name");
	const [messages, setMessages] = useState<DisplayMessage[]>([]);
	const [input, setInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [typing, setTyping] = useState(false);

	const idRef = useRef(0);
	const seeded = useRef(false);
	const nextId = () => `m${idRef.current++}`;

	function pushBot(text: string) {
		setMessages((m) => [
			...m,
			{ id: nextId(), role: "assistant", content: text },
		]);
	}
	function pushUser(text: string) {
		setMessages((m) => [...m, { id: nextId(), role: "user", content: text }]);
	}

	// Seed the opening line + first question once.
	useEffect(() => {
		if (seeded.current) return;
		seeded.current = true;
		pushBot(CONCIERGE_INTRO);
		pushBot(botPrompt("name", emptyDraft()));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Pre-fill the composer with the suggested greeting when we reach that step.
	useEffect(() => {
		if (phase === "welcome") setInput(welcomePrefill(draft));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [phase]);

	function submit(value: string, displayText?: string) {
		if (busy || typing || phase === "done") return;
		const step = phase;
		const err = validateAnswer(step, value);
		if (err) {
			setError(err);
			return;
		}
		setError(null);
		pushUser(displayText ?? (value.trim() || "Skip for now"));
		const updated = applyAnswer(step, value, draft);
		setDraft(updated);
		setInput("");

		const next = nextStep(step);
		if (!next) {
			setPhase("done");
			onComplete(updated);
			return;
		}
		// Brief "typing" beat, then the bot's next question.
		setTyping(true);
		setPhase(next);
		window.setTimeout(() => {
			setTyping(false);
			pushBot(botPrompt(next, updated));
		}, BOT_DELAY_MS);
	}

	const locked = busy || typing;

	return (
		<WidgetFrame
			inline
			brandColor={draft.brandColor || DEFAULT_BRAND}
			open
			onOpenChange={() => {}}
		>
			<MessageList
				greeting=""
				messages={messages}
				typing={typing || busy}
				error={error}
			/>

			{!busy && phase === "brand" && (
				<div className="llmchat-chips" role="group" aria-label="Brand color">
					{BRAND_CHOICES.map((c) => (
						<button
							key={c.value}
							type="button"
							className="llmchat-chip"
							onClick={() => submit(c.value, c.label)}
							disabled={locked}
						>
							<span
								className="llmchat-chip-dot"
								style={{ background: c.value }}
								aria-hidden
							/>
							{c.label}
						</button>
					))}
				</div>
			)}

			{!busy && phase === "source" && (
				<div className="llmchat-chips">
					<button
						type="button"
						className="llmchat-chip"
						onClick={() => submit("", "Skip for now")}
						disabled={locked}
					>
						Skip for now
					</button>
				</div>
			)}

			{!busy && phase !== "brand" && phase !== "done" && (
				<Composer
					value={input}
					disabled={locked}
					onChange={setInput}
					onSubmit={() => submit(input)}
				/>
			)}
		</WidgetFrame>
	);
}
