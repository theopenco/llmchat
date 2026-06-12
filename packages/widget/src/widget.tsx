import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useState } from "react";

import { Composer } from "./components/Composer";
import { EscalationSection } from "./components/EscalationSection";
import { IdentifyForm } from "./components/IdentifyForm";
import { MessageList } from "./components/MessageList";
import { requestEscalation } from "./escalation";
import { getOrCreateClientId, getText } from "./lib";

type WidgetMode = "bubble" | "inline";

interface WidgetProps {
	projectKey: string;
	apiUrl: string;
	brandColor: string;
	/**
	 * "bubble" (default) renders the floating launcher; "inline" renders the
	 * panel permanently open filling the viewport — used by the /embed iframe
	 * page.
	 */
	mode?: WidgetMode;
}

const ESCALATION_THRESHOLD = 3;
const SEND_ERROR =
	"Something went wrong sending your message. Please try again.";

export function Widget({
	projectKey,
	apiUrl,
	brandColor,
	mode = "bubble",
}: WidgetProps) {
	const inline = mode === "inline";
	const [open, setOpen] = useState(inline);
	const [text, setText] = useState("");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [identified, setIdentified] = useState(false);
	const [escalated, setEscalated] = useState(false);
	const [escalating, setEscalating] = useState(false);
	const [escalateFailed, setEscalateFailed] = useState(false);
	const [clientId, setClientId] = useState("");

	useEffect(() => {
		setClientId(getOrCreateClientId());
	}, []);

	const chat = useMemo(
		() =>
			new Chat({
				transport: new DefaultChatTransport({
					api: `${apiUrl}/v1/chat`,
					body: { projectKey, clientId, name, email: email || undefined },
				}),
			}),
		[apiUrl, projectKey, clientId, name, email],
	);
	const { messages, sendMessage, status, error } = useChat({ chat });
	const loading = status === "streaming" || status === "submitted";
	const sendFailed = status === "error" && error != null;

	const displayMessages = useMemo(
		() =>
			messages.map((m) => ({ id: m.id, role: m.role, content: getText(m) })),
		[messages],
	);
	const userMessageCount = displayMessages.filter(
		(m) => m.role === "user",
	).length;
	const showEscalation = !escalated && userMessageCount >= ESCALATION_THRESHOLD;

	function handleSend() {
		void sendMessage({ text: text.trim() });
		setText("");
	}

	async function handleEscalate() {
		if (escalating) {
			return;
		}
		setEscalating(true);
		setEscalateFailed(false);
		try {
			await requestEscalation(apiUrl, {
				projectKey,
				clientId,
				name,
				email: email || undefined,
				messages: displayMessages.map(({ role, content }) => ({
					role,
					content,
				})),
			});
			setEscalated(true);
		} catch {
			setEscalateFailed(true);
		} finally {
			setEscalating(false);
		}
	}

	return (
		<div className="llmchat" style={{ ["--brand" as string]: brandColor }}>
			{!inline && (
				<button
					type="button"
					className="llmchat-bubble"
					onClick={() => setOpen((v) => !v)}
					aria-label={open ? "Close chat" : "Open chat"}
				>
					{open ? "×" : "💬"}
				</button>
			)}
			{open && (
				<div
					className={
						inline ? "llmchat-panel llmchat-panel-inline" : "llmchat-panel"
					}
					role={inline ? undefined : "dialog"}
				>
					<header className="llmchat-header">
						<span>Support</span>
						{!inline && (
							<button
								type="button"
								onClick={() => setOpen(false)}
								aria-label="Close"
							>
								×
							</button>
						)}
					</header>
					{!identified ? (
						<IdentifyForm
							name={name}
							email={email}
							onNameChange={setName}
							onEmailChange={setEmail}
							onSubmit={() => setIdentified(true)}
						/>
					) : (
						<>
							<MessageList
								greeting={`Hi ${name}! How can I help?`}
								messages={displayMessages}
								typing={loading}
								error={sendFailed ? SEND_ERROR : null}
							/>
							{showEscalation && (
								<EscalationSection
									pending={escalating}
									failed={escalateFailed}
									onEscalate={handleEscalate}
								/>
							)}
							{escalated && (
								<div className="llmchat-escalated">
									We&apos;ve notified the team. A human will reply soon.
								</div>
							)}
							<Composer
								value={text}
								disabled={loading}
								onChange={setText}
								onSubmit={handleSend}
							/>
						</>
					)}
				</div>
			)}
		</div>
	);
}
