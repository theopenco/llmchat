import { useEffect, useRef, useState } from "react";

import {
	requestVoiceSession,
	VoiceCallClient,
	VoiceSessionError,
	type VoiceCallStatus,
} from "../voice-call";
import { MicIcon, MicOffIcon, PhoneOffIcon } from "./icons";

const STATUS_LABEL: Record<VoiceCallStatus, string> = {
	connecting: "Connecting…",
	listening: "Listening…",
	speaking: "Speaking…",
	ended: "Call ended",
	unavailable: "Voice is unavailable",
	error: "Call failed",
};

/** Human hint per failure cause — the mic is only ever blamed when the mic
 * permission actually failed, never for a server/plan/connection fault. */
function failureHint(err: unknown): string {
	if (err instanceof VoiceSessionError) {
		if (err.status === 402) {
			return "Voice calls aren't available on this plan.";
		}
		if (err.status === 429) {
			return "The call limit has been reached — please try again later, or keep chatting below.";
		}
		return "The voice service is unavailable right now. Please try again later, or keep chatting below.";
	}
	if (
		err instanceof DOMException &&
		(err.name === "NotAllowedError" || err.name === "SecurityError")
	) {
		return "We couldn't access your microphone. Allow microphone access for this site and try again.";
	}
	if (err instanceof DOMException && err.name === "NotFoundError") {
		return "No microphone was found. Connect one and try again.";
	}
	return "The call couldn't connect. Please try again, or keep chatting below.";
}

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
	const [hint, setHint] = useState<string | null>(null);
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
			} catch (err) {
				// Mint refused, mic denied, or the socket failed — one terminal
				// state, but the hint names the actual cause (a mint failure must
				// never read as a microphone problem). stop() FIRST: it emits
				// "ended", which must not clobber the "error" set here.
				client?.stop();
				if (!cancelled) {
					setHint(failureHint(err));
					setStatus("error");
				}
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
					{hint ?? "We couldn't start the call. Please try again."}
				</p>
			)}
			{status === "unavailable" && (
				<p className="llmchat-voice-hint">
					Voice is unavailable right now — please keep chatting below.
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
