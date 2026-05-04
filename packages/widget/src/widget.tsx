import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

import type { UIMessage } from "ai";

interface WidgetProps {
	projectKey: string;
	apiUrl: string;
	brandColor: string;
}

const CLIENT_ID_KEY = "llmchat_client_id";
const ESCALATION_THRESHOLD = 3;

function getOrCreateClientId(): string {
	const existing = sessionStorage.getItem(CLIENT_ID_KEY);
	if (existing) {
		return existing;
	}
	const id = crypto.randomUUID();
	sessionStorage.setItem(CLIENT_ID_KEY, id);
	return id;
}

function getText(m: UIMessage): string {
	return m.parts
		.filter((p): p is { type: "text"; text: string } => p.type === "text")
		.map((p) => p.text)
		.join("");
}

export function Widget({ projectKey, apiUrl, brandColor }: WidgetProps) {
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [identified, setIdentified] = useState(false);
	const [escalated, setEscalated] = useState(false);
	const [escalating, setEscalating] = useState(false);
	const [clientId, setClientId] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setClientId(getOrCreateClientId());
	}, []);

	const chat = useMemo(
		() =>
			new Chat({
				transport: new DefaultChatTransport({
					api: `${apiUrl}/v1/chat`,
					body: { projectKey, clientId, name, email },
				}),
			}),
		[apiUrl, projectKey, clientId, name, email],
	);
	const { messages, sendMessage, status } = useChat({ chat });
	const loading = status === "streaming" || status === "submitted";

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const userMessageCount = messages.filter((m) => m.role === "user").length;
	const showEscalation =
		!escalated && userMessageCount >= ESCALATION_THRESHOLD;

	function handleIdentify(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) {
			return;
		}
		setIdentified(true);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = text.trim();
		if (!trimmed || loading) {
			return;
		}
		void sendMessage({ text: trimmed });
		setText("");
	}

	async function handleEscalate() {
		setEscalating(true);
		try {
			await fetch(`${apiUrl}/v1/escalate`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectKey,
					clientId,
					name,
					email,
					messages: messages.map((m) => ({
						role: m.role,
						content: getText(m),
					})),
				}),
			});
			setEscalated(true);
		} finally {
			setEscalating(false);
		}
	}

	return (
		<div className="llmchat" style={{ ["--brand" as string]: brandColor }}>
			<button
				type="button"
				className="llmchat-bubble"
				onClick={() => setOpen((v) => !v)}
				aria-label={open ? "Close chat" : "Open chat"}
			>
				{open ? "×" : "💬"}
			</button>
			{open && (
				<div className="llmchat-panel" role="dialog">
					<header className="llmchat-header">
						<span>Support</span>
						<button
							type="button"
							onClick={() => setOpen(false)}
							aria-label="Close"
						>
							×
						</button>
					</header>
					{!identified ? (
						<form onSubmit={handleIdentify} className="llmchat-identify">
							<p>Welcome! Tell us who you are.</p>
							<input
								required
								placeholder="Your name"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
							<input
								type="email"
								placeholder="Email (optional)"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
							<button type="submit">Start chat</button>
						</form>
					) : (
						<>
							<div className="llmchat-messages">
								{messages.length === 0 && (
									<div className="llmchat-msg llmchat-msg-assistant">
										Hi {name}! How can I help?
									</div>
								)}
								{messages.map((m) => {
									const content = getText(m);
									if (!content) {
										return null;
									}
									return (
										<div
											key={m.id}
											className={`llmchat-msg llmchat-msg-${m.role}`}
										>
											{content}
										</div>
									);
								})}
								{loading && <div className="llmchat-typing">…</div>}
								<div ref={messagesEndRef} />
							</div>
							{showEscalation && (
								<div className="llmchat-escalate">
									<button
										type="button"
										onClick={handleEscalate}
										disabled={escalating}
									>
										{escalating ? "Sending…" : "Talk to a human"}
									</button>
								</div>
							)}
							{escalated && (
								<div className="llmchat-escalated">
									We&apos;ve notified our team. Reply will come via email.
								</div>
							)}
							<form onSubmit={handleSubmit} className="llmchat-input">
								<textarea
									rows={1}
									value={text}
									onChange={(e) => setText(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											handleSubmit(e);
										}
									}}
									placeholder="Type a message…"
								/>
								<button type="submit" disabled={!text.trim() || loading}>
									Send
								</button>
							</form>
						</>
					)}
				</div>
			)}
		</div>
	);
}
