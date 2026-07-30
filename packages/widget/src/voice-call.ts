/**
 * Live AI voice call over LLM Gateway's realtime API (Scale-only premium).
 *
 * The widget never holds a long-lived key: it asks the api to mint an
 * EPHEMERAL client secret (`POST /v1/voice/session` — plan-gated server-side)
 * and opens its own WebSocket straight to the gateway with the
 * `openai-insecure-api-key.<secret>` subprotocol, the documented browser
 * transport (WebSocket only — no WebRTC yet). Audio rides the socket as
 * base64 PCM16 inside JSON events, both directions.
 */

/** The realtime API's native PCM rate. Mic input is resampled to this before
 * appending; output deltas are decoded at this rate. */
export const REALTIME_SAMPLE_RATE = 24_000;

// ScriptProcessor block size: a power of two; ~85ms at 48kHz. Big enough to
// keep the event loop light, small enough for conversational latency.
const CAPTURE_BUFFER_SIZE = 4096;

export interface VoiceSessionInfo {
	url: string;
	clientSecret: string;
	model: string;
	/** Server-assembled agent instructions, applied via session.update on
	 * connect — the gateway's mint endpoint doesn't accept them. */
	instructions: string;
	/** Output voice name, same session.update path. */
	voice: string;
}

/** The api refused (or failed) to mint a session — carries the HTTP status so
 * the UI can distinguish "plan gate" (402), "budget hit" (429), and "gateway
 * down" (502) instead of blaming the microphone. */
export class VoiceSessionError extends Error {
	constructor(public readonly status: number) {
		super(`voice session request failed (${status})`);
	}
}

/** Mint a voice session via the api. Throws VoiceSessionError on any non-OK
 * response — including the 402 that means the plan lost voice between config
 * load and the click. */
export async function requestVoiceSession(
	apiUrl: string,
	body: { projectKey: string; clientId: string },
): Promise<VoiceSessionInfo> {
	const res = await fetch(`${apiUrl}/v1/voice/session`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new VoiceSessionError(res.status);
	}
	const data = (await res.json()) as {
		url?: unknown;
		clientSecret?: unknown;
		model?: unknown;
		instructions?: unknown;
		voice?: unknown;
	};
	if (typeof data.url !== "string" || typeof data.clientSecret !== "string") {
		throw new Error("voice session response malformed");
	}
	return {
		url: data.url,
		clientSecret: data.clientSecret,
		model: typeof data.model === "string" ? data.model : "",
		instructions:
			typeof data.instructions === "string" ? data.instructions : "",
		voice: typeof data.voice === "string" ? data.voice : "",
	};
}

/** Float32 [-1,1] samples → base64 of little-endian PCM16 — the realtime
 * `input_audio_buffer.append` payload. Chunked btoa: a spread/apply over a
 * whole utterance would blow the argument limit. */
export function floatToPcm16Base64(samples: Float32Array): string {
	const pcm = new Int16Array(samples.length);
	for (let i = 0; i < samples.length; i++) {
		const s = Math.max(-1, Math.min(1, samples[i]));
		pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
	}
	const bytes = new Uint8Array(pcm.buffer);
	let binary = "";
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

/** Base64 PCM16 (an output_audio delta) → Float32 [-1,1] samples. Typed over
 * a plain ArrayBuffer so the result feeds copyToChannel without a cast. */
export function pcm16Base64ToFloat(b64: string): Float32Array<ArrayBuffer> {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	const pcm = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
	const out = new Float32Array(pcm.length);
	for (let i = 0; i < pcm.length; i++) {
		out[i] = pcm[i] / (pcm[i] < 0 ? 0x8000 : 0x7fff);
	}
	return out;
}

/** Linear resampler for the mic path. Browsers don't all honor a 24kHz
 * AudioContext, so capture runs at the context's native rate and lands here.
 * Identity when the rates already match. */
export function resampleLinear(
	samples: Float32Array<ArrayBuffer>,
	fromRate: number,
	toRate: number,
): Float32Array<ArrayBuffer> {
	if (fromRate === toRate || samples.length === 0) {
		return samples;
	}
	const outLength = Math.max(
		1,
		Math.round((samples.length * toRate) / fromRate),
	);
	const out = new Float32Array(outLength);
	const step = (samples.length - 1) / Math.max(1, outLength - 1);
	for (let i = 0; i < outLength; i++) {
		const pos = i * step;
		const lo = Math.floor(pos);
		const hi = Math.min(samples.length - 1, lo + 1);
		const frac = pos - lo;
		out[i] = samples[lo] * (1 - frac) + samples[hi] * frac;
	}
	return out;
}

export type VoiceCallStatus =
	| "connecting"
	| "listening"
	| "speaking"
	| "ended"
	| "error";

interface VoiceCallHandlers {
	onStatus: (status: VoiceCallStatus) => void;
}

/**
 * One live call: mic → WebSocket up, audio deltas → speaker down. Server VAD
 * runs turn-taking (the gateway detects speech end and responds on its own);
 * a `speech_started` event is the visitor barging in, so scheduled playback is
 * cancelled immediately. `stop()` is idempotent and releases everything —
 * socket, mic, audio context.
 */
export class VoiceCallClient {
	private ws: WebSocket | null = null;
	private ctx: AudioContext | null = null;
	private stream: MediaStream | null = null;
	private processor: ScriptProcessorNode | null = null;
	private source: MediaStreamAudioSourceNode | null = null;
	private playing: AudioBufferSourceNode[] = [];
	private nextPlayTime = 0;
	private speakingUntil: ReturnType<typeof setTimeout> | null = null;
	private greetFallback: ReturnType<typeof setTimeout> | null = null;
	private greeted = false;
	private stopped = false;
	private micMuted = false;

	constructor(
		private session: VoiceSessionInfo,
		private handlers: VoiceCallHandlers,
	) {}

	async start(): Promise<void> {
		this.handlers.onStatus("connecting");
		// Mic first: a permission denial should fail the call before any socket
		// or gateway spend exists.
		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true },
		});
		// Ask for the realtime rate; fall back to the device default and
		// resample in the capture callback (see resampleLinear).
		try {
			this.ctx = new AudioContext({ sampleRate: REALTIME_SAMPLE_RATE });
		} catch {
			this.ctx = new AudioContext();
		}

		await new Promise<void>((resolve, reject) => {
			const ws = new WebSocket(this.session.url, [
				"realtime",
				`openai-insecure-api-key.${this.session.clientSecret}`,
			]);
			this.ws = ws;
			ws.addEventListener("open", () => {
				// The model is locked at mint time; everything else is configured
				// here per the gateway's docs — the server-assembled instructions
				// and voice (its mint endpoint accepts neither), the audio wire
				// format, and server-VAD turn-taking.
				ws.send(
					JSON.stringify({
						type: "session.update",
						session: {
							type: "realtime",
							...(this.session.instructions
								? { instructions: this.session.instructions }
								: {}),
							audio: {
								input: {
									format: {
										type: "audio/pcm",
										rate: REALTIME_SAMPLE_RATE,
									},
									turn_detection: { type: "server_vad" },
								},
								output: {
									format: {
										type: "audio/pcm",
										rate: REALTIME_SAMPLE_RATE,
									},
									...(this.session.voice
										? { voice: this.session.voice }
										: {}),
								},
							},
						},
					}),
				);
				// The greeting response is NOT requested here: response.create in
				// the same breath can race the session.update above, and a model
				// with no instructions yet greets ungrounded (arbitrary language).
				// It fires on the session.updated ack (handleEvent) — with a timer
				// fallback in case the ack never comes.
				this.greetFallback = setTimeout(() => this.greet(), 2_000);
				this.startCapture();
				this.handlers.onStatus("listening");
				resolve();
			});
			ws.addEventListener("message", (e) => this.handleEvent(e));
			ws.addEventListener("error", () => {
				if (!this.stopped) {
					this.handlers.onStatus("error");
				}
				reject(new Error("voice socket failed"));
			});
			ws.addEventListener("close", () => {
				if (!this.stopped) {
					this.stopped = true;
					this.releaseAudio();
					this.handlers.onStatus("ended");
				}
			});
		});
	}

	/** Mute keeps the socket + VAD session alive and simply stops appending
	 * mic audio — resuming is instant. */
	setMuted(muted: boolean) {
		this.micMuted = muted;
	}

	stop() {
		if (this.stopped) {
			return;
		}
		this.stopped = true;
		try {
			this.ws?.close();
		} catch {
			// Already closed/failed — releasing the audio below is what matters.
		}
		this.releaseAudio();
		this.handlers.onStatus("ended");
	}

	private releaseAudio() {
		if (this.greetFallback) {
			clearTimeout(this.greetFallback);
			this.greetFallback = null;
		}
		this.cancelPlayback();
		this.processor?.disconnect();
		this.source?.disconnect();
		this.stream?.getTracks().forEach((t) => t.stop());
		void this.ctx?.close().catch(() => {});
		this.processor = null;
		this.source = null;
		this.stream = null;
		this.ctx = null;
	}

	private startCapture() {
		if (!this.ctx || !this.stream) {
			return;
		}
		this.source = this.ctx.createMediaStreamSource(this.stream);
		// ScriptProcessor over AudioWorklet on purpose: a worklet needs a module
		// URL, which a single-file IIFE embed can't ship without Blob-URL
		// gymnastics that some CSPs block. Deprecated but universally supported.
		this.processor = this.ctx.createScriptProcessor(CAPTURE_BUFFER_SIZE, 1, 1);
		this.processor.onaudioprocess = (e) => {
			if (this.micMuted || this.ws?.readyState !== WebSocket.OPEN) {
				return;
			}
			const captured = e.inputBuffer.getChannelData(0);
			const resampled = resampleLinear(
				captured,
				this.ctx?.sampleRate ?? REALTIME_SAMPLE_RATE,
				REALTIME_SAMPLE_RATE,
			);
			this.ws.send(
				JSON.stringify({
					type: "input_audio_buffer.append",
					audio: floatToPcm16Base64(resampled),
				}),
			);
		};
		this.source.connect(this.processor);
		// Chrome requires ScriptProcessor to be connected to a destination to
		// fire; it outputs silence (1-in/1-out with no writes).
		this.processor.connect(this.ctx.destination);
	}

	private handleEvent(e: MessageEvent) {
		if (typeof e.data !== "string") {
			return; // binary frames are rejected by the gateway anyway
		}
		let event: { type?: string; audio?: string; delta?: string };
		try {
			event = JSON.parse(e.data);
		} catch {
			return;
		}
		switch (event.type) {
			case "session.updated": {
				// Instructions/voice are confirmed applied — NOW the greeting is
				// grounded in the support prompt instead of an empty context.
				this.greet();
				break;
			}
			case "response.output_audio.delta": {
				if (typeof event.delta === "string") {
					this.schedulePlayback(event.delta);
				}
				break;
			}
			case "input_audio_buffer.speech_started": {
				// Barge-in: the visitor started talking over the agent — cut the
				// agent's queued audio right away (the server cancels its side).
				this.cancelPlayback();
				this.handlers.onStatus("listening");
				break;
			}
			case "error": {
				// Surfaced (not swallowed): a rejected session.update leaves the
				// agent running WITHOUT the operator's instructions — the one
				// warn keeps that diagnosable on any embed. Session-fatal errors
				// additionally surface via onclose.
				console.warn(
					"clanker voice: realtime error event",
					(event as { error?: { message?: string } }).error?.message ??
						e.data,
				);
				break;
			}
			default:
				break;
		}
	}

	/** Request the agent's opening greeting exactly once — on the
	 * session.updated ack, or the connect-time fallback timer. */
	private greet() {
		if (this.greetFallback) {
			clearTimeout(this.greetFallback);
			this.greetFallback = null;
		}
		if (this.greeted || this.stopped) {
			return;
		}
		this.greeted = true;
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: "response.create" }));
		}
	}

	private schedulePlayback(deltaB64: string) {
		const ctx = this.ctx;
		if (!ctx || this.stopped) {
			return;
		}
		const samples = pcm16Base64ToFloat(deltaB64);
		if (samples.length === 0) {
			return;
		}
		// AudioBuffers carry their own rate — the context resamples on play, so
		// this stays correct even when the 24kHz context request fell back.
		const buffer = ctx.createBuffer(1, samples.length, REALTIME_SAMPLE_RATE);
		buffer.copyToChannel(samples, 0);
		const node = ctx.createBufferSource();
		node.buffer = buffer;
		node.connect(ctx.destination);
		const startAt = Math.max(ctx.currentTime, this.nextPlayTime);
		node.start(startAt);
		this.nextPlayTime = startAt + buffer.duration;
		this.playing.push(node);
		node.addEventListener("ended", () => {
			this.playing = this.playing.filter((n) => n !== node);
		});

		this.handlers.onStatus("speaking");
		// Flip back to "listening" when the scheduled tail drains. Each new
		// delta pushes the deadline out, so only the last one fires.
		if (this.speakingUntil) {
			clearTimeout(this.speakingUntil);
		}
		this.speakingUntil = setTimeout(
			() => {
				if (!this.stopped) {
					this.handlers.onStatus("listening");
				}
			},
			Math.max(0, (this.nextPlayTime - ctx.currentTime) * 1000) + 150,
		);
	}

	private cancelPlayback() {
		if (this.speakingUntil) {
			clearTimeout(this.speakingUntil);
			this.speakingUntil = null;
		}
		for (const node of this.playing) {
			try {
				node.stop();
			} catch {
				// Already ended — nothing to cut.
			}
		}
		this.playing = [];
		this.nextPlayTime = 0;
	}
}
