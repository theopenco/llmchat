import { useEffect, useRef, useState } from "react";

import { Composer } from "./components/Composer";
import { EscalationSection } from "./components/EscalationSection";
import { MessageList } from "./components/MessageList";

import type { DisplayMessage } from "./components/MessageList";

export const SHOWCASE_NOTE =
	"This is a showcase preview. Messages are not sent to support.";
export const SHOWCASE_HANDOFF_NOTICE =
	"Human handoff is disabled in showcase mode. Use the real chat widget to contact support.";

const DEMO_REPLIES = [
	"Thanks for trying the demo! In live mode I answer from your project's instructions and sources.",
	"Good question! A real deployment would search your knowledge base and reply with specifics.",
	"This showcase replies locally — connect a project to get real AI answers and human handoff.",
];

const REPLY_DELAY_MS = 700;
const ESCALATION_THRESHOLD = 3;

/**
 * Showcase-mode conversation: everything stays in local state. No
 * conversation APIs are called, nothing is persisted, and escalation only
 * shows a local notice pointing at the real widget.
 */
export function ShowcaseChat() {
	const [messages, setMessages] = useState<DisplayMessage[]>([]);
	const [text, setText] = useState("");
	const [typing, setTyping] = useState(false);
	const [handoffNotice, setHandoffNotice] = useState(false);
	const replyIndex = useRef(0);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => () => clearTimeout(timer.current), []);

	function handleSend() {
		const content = text.trim();
		if (!content || typing) {
			return;
		}
		setMessages((m) => [
			...m,
			{ id: `demo-user-${m.length}`, role: "user", content },
		]);
		setText("");
		setTyping(true);
		const reply = DEMO_REPLIES[replyIndex.current % DEMO_REPLIES.length]!;
		replyIndex.current += 1;
		timer.current = setTimeout(() => {
			setMessages((m) => [
				...m,
				{ id: `demo-assistant-${m.length}`, role: "assistant", content: reply },
			]);
			setTyping(false);
		}, REPLY_DELAY_MS);
	}

	const userMessageCount = messages.filter((m) => m.role === "user").length;
	const showEscalation =
		!handoffNotice && userMessageCount >= ESCALATION_THRESHOLD;

	return (
		<>
			<div className="llmchat-demo-note">{SHOWCASE_NOTE}</div>
			<MessageList
				greeting="Hi there! Ask me anything — this demo replies locally."
				messages={messages}
				typing={typing}
				error={null}
			/>
			{showEscalation && (
				<EscalationSection
					pending={false}
					failed={false}
					onEscalate={() => setHandoffNotice(true)}
				/>
			)}
			{handoffNotice && (
				<div className="llmchat-escalated">{SHOWCASE_HANDOFF_NOTICE}</div>
			)}
			<Composer
				value={text}
				disabled={typing}
				onChange={setText}
				onSubmit={handleSend}
			/>
		</>
	);
}
