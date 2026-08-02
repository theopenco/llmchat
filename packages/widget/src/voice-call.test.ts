import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	floatToPcm16Base64,
	frameRms,
	pcm16Base64ToFloat,
	resampleLinear,
	REALTIME_SAMPLE_RATE,
	SETUP_ACK_TIMEOUT_MS,
	VoiceCallClient,
	type VoiceCallStatus,
} from "./voice-call";

describe("PCM16 base64 codec", () => {
	it("round-trips samples within quantization error", () => {
		const input = new Float32Array([0, 0.5, -0.5, 1, -1, 0.123, -0.987]);
		const out = pcm16Base64ToFloat(floatToPcm16Base64(input));
		expect(out.length).toBe(input.length);
		for (let i = 0; i < input.length; i++) {
			expect(Math.abs(out[i] - input[i])).toBeLessThan(1 / 0x7fff + 1e-6);
		}
	});

	it("clamps out-of-range samples instead of wrapping", () => {
		// An overdriven mic sample must saturate (±1), never wrap to the
		// opposite sign — a wrap would be an audible full-scale click.
		const out = pcm16Base64ToFloat(
			floatToPcm16Base64(new Float32Array([2.5, -2.5])),
		);
		expect(out[0]).toBeCloseTo(1, 4);
		expect(out[1]).toBeCloseTo(-1, 4);
	});

	it("survives a large buffer (chunked btoa path)", () => {
		// > one 0x8000-byte chunk, exercising the chunked binary-string build.
		const big = new Float32Array(100_000).fill(0.25);
		const out = pcm16Base64ToFloat(floatToPcm16Base64(big));
		expect(out.length).toBe(big.length);
		expect(out[99_999]).toBeCloseTo(0.25, 3);
	});
});

describe("resampleLinear", () => {
	it("is the identity when rates match", () => {
		const input = new Float32Array([0.1, 0.2, 0.3]);
		expect(
			resampleLinear(input, REALTIME_SAMPLE_RATE, REALTIME_SAMPLE_RATE),
		).toBe(input);
	});

	it("halves the sample count when downsampling 48k → 24k", () => {
		const input = new Float32Array(4800).fill(0.5);
		const out = resampleLinear(input, 48_000, 24_000);
		expect(out.length).toBe(2400);
		// A constant signal stays constant through linear interpolation.
		expect(out[0]).toBeCloseTo(0.5, 6);
		expect(out[out.length - 1]).toBeCloseTo(0.5, 6);
	});

	it("preserves the endpoints of a ramp", () => {
		const input = new Float32Array([0, 0.25, 0.5, 0.75, 1]);
		const out = resampleLinear(input, 44_100, 24_000);
		expect(out[0]).toBeCloseTo(0, 6);
		expect(out[out.length - 1]).toBeCloseTo(1, 6);
	});

	it("handles the empty buffer without dividing by zero", () => {
		const out = resampleLinear(new Float32Array(0), 48_000, 24_000);
		expect(out.length).toBe(0);
	});
});

describe("frameRms", () => {
	it("is 0 for silence and empty frames", () => {
		expect(frameRms(new Float32Array(0))).toBe(0);
		expect(frameRms(new Float32Array(512))).toBe(0);
	});

	it("measures a constant signal's level exactly", () => {
		expect(frameRms(new Float32Array(256).fill(0.5))).toBeCloseTo(0.5, 6);
		expect(frameRms(new Float32Array(256).fill(-0.5))).toBeCloseTo(0.5, 6);
	});

	it("separates deliberate speech from quiet echo around the gate level", () => {
		// A full-scale sine (deliberate, close speech) sits at ~0.707 RMS —
		// far above the 0.07 gate; a -32 dBFS-ish murmur sits below it.
		const loud = Float32Array.from({ length: 480 }, (_, i) =>
			Math.sin((i / 480) * 2 * Math.PI * 10),
		);
		expect(frameRms(loud)).toBeGreaterThan(0.07);
		expect(frameRms(new Float32Array(480).fill(0.02))).toBeLessThan(0.07);
	});
});

// ---------------------------------------------------------------------------
// Setup-ack hardening (item 0 client half): the model must never take a turn
// before session.updated confirms the operator's instructions were applied,
// and a rejected/unacked configuring update must end as "unavailable" — never
// as a live, ungrounded call.
// ---------------------------------------------------------------------------

class FakeWebSocket {
	static OPEN = 1;
	static instances: FakeWebSocket[] = [];
	readyState = FakeWebSocket.OPEN;
	sent: string[] = [];
	closed = false;
	private listeners = new Map<string, ((e: unknown) => void)[]>();

	constructor(
		public url: string,
		public protocols: string[],
	) {
		FakeWebSocket.instances.push(this);
	}

	addEventListener(type: string, fn: (e: unknown) => void) {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
	}

	send(data: string) {
		this.sent.push(data);
	}

	close() {
		this.closed = true;
		this.readyState = 3;
		this.emit("close", {});
	}

	emit(type: string, e: unknown) {
		for (const fn of this.listeners.get(type) ?? []) {
			fn(e);
		}
	}

	sentTypes(): string[] {
		return this.sent.map((s) => (JSON.parse(s) as { type: string }).type);
	}
}

class FakeProcessor {
	onaudioprocess: ((e: unknown) => void) | null = null;
	connect() {}
	disconnect() {}
}

class FakeAudioContext {
	static lastProcessor: FakeProcessor | null = null;
	sampleRate = REALTIME_SAMPLE_RATE;
	currentTime = 0;
	destination = {};

	createMediaStreamSource() {
		return { connect() {}, disconnect() {} };
	}

	createScriptProcessor() {
		const p = new FakeProcessor();
		FakeAudioContext.lastProcessor = p;
		return p;
	}

	async close() {}
}

function loudFrame() {
	return {
		inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.5) },
	};
}

describe("VoiceCallClient setup-ack hardening", () => {
	beforeEach(() => {
		FakeWebSocket.instances = [];
		FakeAudioContext.lastProcessor = null;
		vi.stubGlobal("WebSocket", FakeWebSocket);
		vi.stubGlobal("AudioContext", FakeAudioContext);
		vi.stubGlobal("navigator", {
			mediaDevices: {
				getUserMedia: async () => ({ getTracks: () => [] }),
			},
		});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	async function startClient() {
		const statuses: VoiceCallStatus[] = [];
		const client = new VoiceCallClient(
			{
				url: "wss://gw.test/v1/realtime?model=gpt-realtime",
				clientSecret: "ek_test",
				model: "gpt-realtime",
				instructions: "GROUNDED-INSTRUCTIONS",
				voice: "marin",
			},
			{ onStatus: (s) => statuses.push(s) },
		);
		const started = client.start();
		// start() awaits getUserMedia before opening the socket — drain the
		// microtask chain until the fake socket exists.
		for (let i = 0; i < 10 && FakeWebSocket.instances.length === 0; i++) {
			await Promise.resolve();
		}
		const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
		ws.emit("open", {});
		await started;
		return { client, ws, statuses };
	}

	it("greets ONLY after session.updated, and mic frames wait for the ack", async () => {
		const { ws, client, statuses } = await startClient();
		// Status honesty: "Listening…" is a lie while the gate drops frames —
		// the client stays "connecting" until the ack.
		expect(statuses).toEqual(["connecting"]);
		// The configuring update is the first and only frame so far…
		expect(ws.sentTypes()).toEqual(["session.update"]);
		const update = JSON.parse(ws.sent[0]) as {
			session: { instructions?: string };
		};
		expect(update.session.instructions).toBe("GROUNDED-INSTRUCTIONS");
		// …a loud mic frame BEFORE the ack is dropped (no ungrounded turn)…
		FakeAudioContext.lastProcessor?.onaudioprocess?.(loudFrame());
		expect(ws.sentTypes()).toEqual(["session.update"]);
		// …and no greeting has been requested yet.
		ws.emit("message", { data: JSON.stringify({ type: "session.updated" }) });
		expect(ws.sentTypes()).toEqual(["session.update", "response.create"]);
		expect(statuses).toContain("listening");
		// After the ack, mic frames flow.
		FakeAudioContext.lastProcessor?.onaudioprocess?.(loudFrame());
		expect(ws.sentTypes()).toEqual([
			"session.update",
			"response.create",
			"input_audio_buffer.append",
		]);
		client.stop();
	});

	it("rejected instructions → unavailable + closed, zero ungrounded turns", async () => {
		const { ws, statuses } = await startClient();
		// The upstream rejects the configuring update (e.g. instructions over
		// its 16,384-token cap): an error event arrives and NO ack ever will.
		ws.emit("message", {
			data: JSON.stringify({
				type: "error",
				error: { message: "instructions too long" },
			}),
		});
		expect(statuses[statuses.length - 1]).toBe("unavailable");
		expect(ws.closed).toBe(true);
		// The killed path: warn-and-continue used to leave this call live and
		// ungrounded. No greeting, no audio — ever.
		expect(ws.sentTypes()).toEqual(["session.update"]);
		expect(statuses).not.toContain("ended"); // terminal state is unavailable
	});

	it("no ack within the setup timeout → unavailable, no greeting", async () => {
		vi.useFakeTimers();
		const { ws, statuses } = await startClient();
		vi.advanceTimersByTime(SETUP_ACK_TIMEOUT_MS + 1);
		expect(statuses[statuses.length - 1]).toBe("unavailable");
		expect(ws.closed).toBe(true);
		expect(ws.sentTypes()).toEqual(["session.update"]);
	});

	it("post-ack errors stay non-fatal — the session is already grounded", async () => {
		const { ws, statuses, client } = await startClient();
		ws.emit("message", { data: JSON.stringify({ type: "session.updated" }) });
		ws.emit("message", {
			data: JSON.stringify({ type: "error", error: { message: "transient" } }),
		});
		expect(ws.closed).toBe(false);
		expect(statuses).not.toContain("unavailable");
		client.stop();
	});

	it("refuses to start a call with empty instructions — unavailable, no mic, no socket", async () => {
		const statuses: VoiceCallStatus[] = [];
		const client = new VoiceCallClient(
			{
				url: "wss://gw.test/v1/realtime",
				clientSecret: "ek_test",
				model: "gpt-realtime",
				instructions: "",
				voice: "marin",
			},
			{ onStatus: (s) => statuses.push(s) },
		);
		await client.start();
		expect(statuses).toEqual(["unavailable"]);
		expect(FakeWebSocket.instances).toHaveLength(0);
	});

	it("stop() during the mic-permission prompt never leaves a hot mic or a socket", async () => {
		const track = { stop: vi.fn() };
		let grant: (s: unknown) => void = () => {};
		vi.stubGlobal("navigator", {
			mediaDevices: {
				getUserMedia: () =>
					new Promise((resolve) => {
						grant = resolve;
					}),
			},
		});
		const client = new VoiceCallClient(
			{
				url: "wss://gw.test/v1/realtime",
				clientSecret: "ek_test",
				model: "gpt-realtime",
				instructions: "GROUNDED",
				voice: "marin",
			},
			{ onStatus: () => {} },
		);
		const started = client.start();
		client.stop(); // visitor closed the panel while the permission prompt was up
		grant({ getTracks: () => [track] }); // then granted the permission
		await started;
		expect(track.stop).toHaveBeenCalled(); // the just-granted mic is released…
		expect(FakeWebSocket.instances).toHaveLength(0); // …and no socket ever opens
	});

	it("server close BEFORE the ack is a failed setup (unavailable), after it a normal end", async () => {
		const early = await startClient();
		early.ws.emit("close", {});
		expect(early.statuses[early.statuses.length - 1]).toBe("unavailable");

		FakeWebSocket.instances = [];
		const late = await startClient();
		late.ws.emit("message", {
			data: JSON.stringify({ type: "session.updated" }),
		});
		late.ws.emit("close", {});
		expect(late.statuses[late.statuses.length - 1]).toBe("ended");
	});
});
