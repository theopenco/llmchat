import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The whole point of the call-error screen is to name the REAL cause: a plan
// gate, a call-budget hit, a gateway outage, or an actual microphone problem —
// and to blame the mic ONLY when the mic actually failed. We drive VoiceCall
// through each failure and assert the visitor-facing hint, keeping the real
// VoiceSessionError class so its `instanceof` branch is exercised.

const requestVoiceSession = vi.fn();
const startMock = vi.fn();
const stopMock = vi.fn();

vi.mock("../voice-call", async () => {
	const actual =
		await vi.importActual<typeof import("../voice-call")>("../voice-call");
	return {
		...actual,
		requestVoiceSession: (...args: unknown[]) => requestVoiceSession(...args),
		postVoiceTranscript: vi.fn(async () => {}),
		VoiceCallClient: class {
			start = startMock;
			stop = stopMock;
			setMuted = vi.fn();
		},
	};
});

import { VoiceSessionError } from "../voice-call";
import { VoiceCall } from "./VoiceCall";

afterEach(() => {
	vi.clearAllMocks();
});

function okSession() {
	return {
		url: "wss://gw/rt",
		clientSecret: "ek",
		model: "gpt-realtime",
		instructions: "hi",
		voice: "alloy",
	};
}

function mount() {
	render(
		<VoiceCall
			apiUrl="https://api.example"
			projectKey="pk"
			clientId="c"
			onClose={() => {}}
		/>,
	);
}

describe("VoiceCall error hints", () => {
	it("blames the plan, not the mic, on a 402 mint failure", async () => {
		requestVoiceSession.mockRejectedValue(new VoiceSessionError(402));
		mount();
		expect(
			await screen.findByText(/aren't available on this plan/i),
		).toBeTruthy();
		expect(screen.queryByText(/microphone/i)).toBeNull();
		expect(startMock).not.toHaveBeenCalled();
	});

	it("names the call limit on a 429 mint failure", async () => {
		requestVoiceSession.mockRejectedValue(new VoiceSessionError(429));
		mount();
		expect(
			await screen.findByText(/call limit has been reached/i),
		).toBeTruthy();
		expect(screen.queryByText(/microphone/i)).toBeNull();
	});

	it("names the voice service on a gateway (502) mint failure", async () => {
		requestVoiceSession.mockRejectedValue(new VoiceSessionError(502));
		mount();
		expect(
			await screen.findByText(/voice service is unavailable/i),
		).toBeTruthy();
		expect(screen.queryByText(/microphone/i)).toBeNull();
	});

	it("blames the mic ONLY when getUserMedia is denied", async () => {
		requestVoiceSession.mockResolvedValue(okSession());
		// The session mints fine; the failure is the mic prompt during start().
		startMock.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
		mount();
		expect(
			await screen.findByText(/couldn't access your microphone/i),
		).toBeTruthy();
	});

	it("falls back to a connection hint for an unclassified failure", async () => {
		requestVoiceSession.mockResolvedValue(okSession());
		// Socket blew up after a clean mint + mic grant — not a plan/mic fault.
		startMock.mockRejectedValue(new Error("socket closed"));
		mount();
		expect(await screen.findByText(/couldn't connect/i)).toBeTruthy();
		expect(screen.queryByText(/microphone/i)).toBeNull();
	});
});
