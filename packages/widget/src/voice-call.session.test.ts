import { afterEach, describe, expect, it, vi } from "vitest";

import { requestVoiceSession, VoiceSessionError } from "./voice-call";

// The widget mints an ephemeral voice session via the api before opening its
// own socket to the gateway. requestVoiceSession is the whole client side of
// that handshake: it must carry the HTTP status out on failure (so the UI can
// name a plan gate / budget hit / gateway fault instead of blaming the mic)
// and reject a malformed OK body rather than handing junk to VoiceCallClient.

function jsonResponse(status: number, body: unknown) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	} as unknown as Response;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("requestVoiceSession", () => {
	it("posts JSON to /v1/voice/session and returns the parsed session", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			jsonResponse(200, {
				url: "wss://gw.example/rt",
				clientSecret: "ek_secret",
				model: "gpt-realtime",
				instructions: "Be helpful.",
				voice: "alloy",
			}),
		);

		const session = await requestVoiceSession("https://api.example", {
			projectKey: "pk_1",
			clientId: "c_1",
		});

		expect(session).toEqual({
			url: "wss://gw.example/rt",
			clientSecret: "ek_secret",
			model: "gpt-realtime",
			instructions: "Be helpful.",
			voice: "alloy",
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [calledUrl, init] = fetchMock.mock.calls[0];
		expect(calledUrl).toBe("https://api.example/v1/voice/session");
		const requestInit = init as RequestInit;
		expect(requestInit.method).toBe("POST");
		expect(
			(requestInit.headers as Record<string, string>)["content-type"],
		).toBe("application/json");
		expect(JSON.parse(requestInit.body as string)).toEqual({
			projectKey: "pk_1",
			clientId: "c_1",
		});
	});

	it("defaults the optional fields to empty strings when the body omits them", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			jsonResponse(200, { url: "wss://gw/rt", clientSecret: "ek" }),
		);

		const session = await requestVoiceSession("https://api.example", {
			projectKey: "pk",
			clientId: "c",
		});

		expect(session.url).toBe("wss://gw/rt");
		expect(session.clientSecret).toBe("ek");
		// A gateway that returns these as null/absent must not surface `undefined`
		// or a stringified null into the session.update payload.
		expect(session.model).toBe("");
		expect(session.instructions).toBe("");
		expect(session.voice).toBe("");
	});

	it.each([402, 429, 502])(
		"throws a VoiceSessionError carrying status %i on a non-OK response",
		async (status) => {
			vi.spyOn(globalThis, "fetch").mockResolvedValue(
				jsonResponse(status, { error: "nope" }),
			);

			const err = await requestVoiceSession("https://api.example", {
				projectKey: "pk",
				clientId: "c",
			}).catch((e) => e);

			// The status is the load-bearing detail: the error screen reads it to
			// distinguish a 402 plan gate / 429 budget hit from a mic fault. If the
			// type or status is lost, a paywalled call reads as "check your mic".
			expect(err).toBeInstanceOf(VoiceSessionError);
			expect((err as VoiceSessionError).status).toBe(status);
		},
	);

	it("rejects a malformed OK body with a plain (non-session) error", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			// 200 but no clientSecret — handing this to VoiceCallClient would open a
			// socket with an undefined subprotocol secret.
			jsonResponse(200, { url: "wss://gw/rt" }),
		);

		const err = await requestVoiceSession("https://api.example", {
			projectKey: "pk",
			clientId: "c",
		}).catch((e) => e);

		expect(err).toBeInstanceOf(Error);
		expect(err).not.toBeInstanceOf(VoiceSessionError);
		expect((err as Error).message).toMatch(/malformed/i);
	});

	it("rejects when url is present but not a string", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			jsonResponse(200, { url: 123, clientSecret: "ek" }),
		);

		await expect(
			requestVoiceSession("https://api.example", {
				projectKey: "pk",
				clientId: "c",
			}),
		).rejects.toThrow(/malformed/i);
	});
});
