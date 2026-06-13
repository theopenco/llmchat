import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

import { Composer } from "./components/Composer";
import { EscalationSection } from "./components/EscalationSection";
import { IdentifyForm } from "./components/IdentifyForm";
import { MessageList } from "./components/MessageList";
import { WidgetFrame } from "./components/WidgetFrame";
import { requestEscalation } from "./escalation";
import { getOrCreateClientId, getText } from "./lib";
import { mergeMessages } from "./messages-sync";
import { ShowcaseChat } from "./ShowcaseChat";
import { useServerMessages } from "./useServerMessages";

/**
 * "live" (default) talks to the real API: conversations are created and
 * persisted, escalation notifies the team. "showcase" is a self-contained
 * demo: local state only, canned replies, no network calls ever.
 */
export type WidgetMode = "showcase" | "live";

/**
 * "bubble" (default) renders the floating launcher; "inline" renders the
 * panel permanently open filling its container — the /embed iframe page or
 * any position:relative wrapper.
 */
export type WidgetLayout = "bubble" | "inline";

interface BaseWidgetProps {
	brandColor: string;
	mode?: WidgetLayout;
}

interface LiveWidgetProps extends BaseWidgetProps {
	widgetMode?: "live";
	projectKey: string;
	apiUrl: string;
}

interface ShowcaseWidgetProps extends BaseWidgetProps {
	widgetMode: "showcase";
	projectKey?: string;
	apiUrl?: string;
}

export type WidgetProps = LiveWidgetProps | ShowcaseWidgetProps;

export function Widget(props: WidgetProps) {
	if (props.widgetMode === "showcase") {
		return <ShowcaseWidget brandColor={props.brandColor} mode={props.mode} />;
	}
	return <LiveWidget {...props} />;
}

function ShowcaseWidget({ brandColor, mode = "bubble" }: BaseWidgetProps) {
	const inline = mode === "inline";
	const [open, setOpen] = useState(inline);
	return (
		<WidgetFrame
			inline={inline}
			brandColor={brandColor}
			open={open}
			onOpenChange={setOpen}
			badge={<span className="llmchat-demo-badge">Demo mode</span>}
		>
			<ShowcaseChat />
		</WidgetFrame>
	);
}

const ESCALATION_THRESHOLD = 3;
const SEND_ERROR =
	"Something went wrong sending your message. Please try again.";
const ESCALATED_NOTICE =
	"A human operator has been notified. We’ll get back to you soon.";

function LiveWidget({
	projectKey,
	apiUrl,
	brandColor,
	mode = "bubble",
}: LiveWidgetProps) {
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

	// Poll the persisted feed while chatting so admin replies from the
	// dashboard appear without a refresh.
	const { serverMessages, refresh } = useServerMessages(
		apiUrl,
		projectKey,
		clientId,
		open && identified,
	);

	// Refetch as soon as a send settles (stream finished or failed) so the
	// just-persisted exchange replaces the local copy immediately.
	const wasLoading = useRef(false);
	useEffect(() => {
		if (wasLoading.current && !loading) {
			refresh();
		}
		wasLoading.current = loading;
	}, [loading, refresh]);

	const displayMessages = useMemo(
		() =>
			mergeMessages(
				serverMessages,
				messages.map((m) => ({ id: m.id, role: m.role, content: getText(m) })),
			),
		[serverMessages, messages],
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
			refresh();
		} catch {
			setEscalateFailed(true);
		} finally {
			setEscalating(false);
		}
	}

	return (
		<WidgetFrame
			inline={inline}
			brandColor={brandColor}
			open={open}
			onOpenChange={setOpen}
		>
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
						<div className="llmchat-escalated">{ESCALATED_NOTICE}</div>
					)}
					<Composer
						value={text}
						disabled={loading}
						onChange={setText}
						onSubmit={handleSend}
					/>
				</>
			)}
		</WidgetFrame>
	);
}
