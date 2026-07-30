import { useEffect, useRef, useState } from "react";

import {
	requestVoiceSession,
	VoiceCallClient,
	type VoiceCallStatus,
} from "../voice-call";
import { MicIcon, MicOffIcon, PhoneOffIcon } from "./icons";

const STATUS_LABEL: Record<VoiceCallStatus, string> = {
	connecting: "Connecting…",
	listening: "Listening…",
	speaking: "Speaking…",
	ended: "Call ended",
	error: "Call failed",
};

/**
 * The in-panel voice-call screen (Scale-only). Owns the whole call lifecycle:
 * mints the session on mount, runs the call, and releases mic/socket/audio on
 * unmount — closing the panel or ending the call can never leak a live mic.
 */
export function VoiceCall({
	apiUrl,
	projectKey,
	clientId,
	onClose,
}: {
	apiUrl: string;
	projectKey: string;
	clientId: string;
	onClose: () => void;
}) {
	const [status, setStatus] = useState<VoiceCallStatus>("connecting");
	const [muted, setMuted] = useState(false);
	const clientRef = useRef<VoiceCallClient | null>(null);

	useEffect(() => {
		let cancelled = false;
		let client: VoiceCallClient | null = null;
		(async () => {
			try {
				const session = await requestVoiceSession(apiUrl, {
					projectKey,
					clientId,
				});
				if (cancelled) {
					return;
				}
				client = new VoiceCallClient(session, {
					// Guarded: a straggling socket event after unmount must not
					// setState on a dead component.
					onStatus: (s) => {
						if (!cancelled) {
							setStatus(s);
						}
					},
				});
				clientRef.current = client;
				await client.start();
			} catch {
				// Mic denied, mint 402/429, or the socket failed — one terminal
				// state; the visitor can retry from the header button.
				if (!cancelled) {
					setStatus("error");
				}
				client?.stop();
			}
		})();
		return () => {
			cancelled = true;
			client?.stop();
			clientRef.current = null;
		};
	}, [apiUrl, projectKey, clientId]);

	const live =
		status === "connecting" || status === "listening" || status === "speaking";

	function toggleMute() {
		const next = !muted;
		setMuted(next);
		clientRef.current?.setMuted(next);
	}

	function endCall() {
		clientRef.current?.stop();
		onClose();
	}

	return (
		<div className="llmchat-voice" role="region" aria-label="Voice call">
			<div
				className={[
					"llmchat-voice-orb",
					status === "speaking" ? "llmchat-voice-orb--speaking" : "",
					status === "listening" ? "llmchat-voice-orb--listening" : "",
				]
					.filter(Boolean)
					.join(" ")}
				aria-hidden="true"
			/>
			<p className="llmchat-voice-status" role="status">
				{STATUS_LABEL[status]}
			</p>
			{status === "error" && (
				<p className="llmchat-voice-hint">
					We couldn't start the call. Check your microphone permission and try
					again, or keep chatting below.
				</p>
			)}
			<div className="llmchat-voice-controls">
				{live && (
					<button
						type="button"
						className="llmchat-voice-btn"
						onClick={toggleMute}
						aria-label={muted ? "Unmute microphone" : "Mute microphone"}
						aria-pressed={muted}
					>
						{muted ? <MicOffIcon /> : <MicIcon />}
					</button>
				)}
				<button
					type="button"
					className="llmchat-voice-btn llmchat-voice-btn--end"
					onClick={endCall}
					aria-label={live ? "End call" : "Back to chat"}
				>
					<PhoneOffIcon />
				</button>
			</div>
		</div>
	);
}
