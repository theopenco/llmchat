import { afterEach, describe, expect, it, vi } from "vitest";

import { CalcomError, calcomCreateBooking, calcomGetSlots } from "./calcom";

import type { CalcomConfig } from "@llmchat/shared";

const CFG: CalcomConfig = {
	apiKey: "cal_test_key",
	eventTypeId: 123,
	timeZone: "Europe/Paris",
};

function stubFetch(status: number, body: unknown) {
	const calls: { url: string; init: RequestInit }[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init: RequestInit) => {
			calls.push({ url, init });
			return new Response(JSON.stringify(body), { status });
		}),
	);
	return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("calcomGetSlots", () => {
	it("sends the event type, range, timezone, auth and version headers", async () => {
		const calls = stubFetch(200, { status: "success", data: {} });
		await calcomGetSlots(CFG, { start: "2026-07-07", end: "2026-07-09" });
		expect(calls).toHaveLength(1);
		const url = new URL(calls[0]!.url);
		expect(url.origin).toBe("https://api.cal.com");
		expect(url.pathname).toBe("/v2/slots");
		expect(url.searchParams.get("eventTypeId")).toBe("123");
		expect(url.searchParams.get("start")).toBe("2026-07-07");
		expect(url.searchParams.get("timeZone")).toBe("Europe/Paris");
		const headers = calls[0]!.init.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer cal_test_key");
		expect(headers["cal-api-version"]).toBe("2024-09-04");
	});

	it("flattens the per-day map into a sorted, capped list", async () => {
		stubFetch(200, {
			status: "success",
			data: {
				"2026-07-08": [{ start: "2026-07-08T09:00:00.000Z" }],
				"2026-07-07": [
					{ start: "2026-07-07T10:00:00.000Z" },
					{ start: "2026-07-07T09:00:00.000Z" },
				],
			},
		});
		const slots = await calcomGetSlots(CFG, {
			start: "2026-07-07",
			end: "2026-07-09",
			maxSlots: 2,
		});
		expect(slots).toEqual([
			{ start: "2026-07-07T09:00:00.000Z" },
			{ start: "2026-07-07T10:00:00.000Z" },
		]);
	});

	it("pins the host to api.cal.com — the config cannot redirect it (SSRF fix)", async () => {
		// The stored config has no apiBase field any more; even a stray one is
		// ignored, so the Bearer key can only ever be sent to api.cal.com.
		const calls = stubFetch(200, { status: "success", data: {} });
		await calcomGetSlots(
			{ ...CFG, apiBase: "http://evil.example" } as CalcomConfig,
			{ start: "2026-07-07", end: "2026-07-08" },
		);
		expect(new URL(calls[0]!.url).origin).toBe("https://api.cal.com");
	});

	it("uses a TRUSTED baseOverride param (tests / self-hosters / demo mock)", async () => {
		const calls = stubFetch(200, { status: "success", data: {} });
		await calcomGetSlots(
			CFG,
			{ start: "2026-07-07", end: "2026-07-08" },
			"http://127.0.0.1:9099",
		);
		expect(calls[0]!.url.startsWith("http://127.0.0.1:9099/v2/slots")).toBe(
			true,
		);
	});

	it("throws a CalcomError with the upstream message on failure", async () => {
		stubFetch(400, {
			status: "error",
			error: { message: "no_available_users_found_error" },
		});
		await expect(
			calcomGetSlots(CFG, { start: "2026-07-07", end: "2026-07-08" }),
		).rejects.toThrow("no_available_users_found_error");
	});
});

describe("calcomCreateBooking", () => {
	it("POSTs the booking with attendee + event type and returns the confirmation", async () => {
		const calls = stubFetch(201, {
			status: "success",
			data: {
				uid: "bk_1",
				status: "accepted",
				start: "2026-07-07T09:00:00.000Z",
				end: "2026-07-07T09:30:00.000Z",
				location: "https://zoom.us/j/123",
			},
		});
		const booking = await calcomCreateBooking(CFG, {
			start: "2026-07-07T09:00:00.000Z",
			name: "Ada",
			email: "ada@example.com",
		});
		expect(booking).toEqual({
			uid: "bk_1",
			status: "accepted",
			start: "2026-07-07T09:00:00.000Z",
			end: "2026-07-07T09:30:00.000Z",
			location: "https://zoom.us/j/123",
		});
		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.eventTypeId).toBe(123);
		expect(body.attendee).toEqual({
			name: "Ada",
			email: "ada@example.com",
			timeZone: "Europe/Paris",
		});
		const headers = calls[0]!.init.headers as Record<string, string>;
		expect(headers["cal-api-version"]).toBe("2024-08-13");
	});

	it("rejects a success envelope without a booking uid", async () => {
		stubFetch(201, { status: "success", data: { status: "accepted" } });
		await expect(
			calcomCreateBooking(CFG, {
				start: "2026-07-07T09:00:00.000Z",
				name: "Ada",
				email: "ada@example.com",
			}),
		).rejects.toBeInstanceOf(CalcomError);
	});

	it("wraps network failures in a visitor-safe message", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("ECONNREFUSED 1.2.3.4:443 secret-internal-host");
			}),
		);
		await expect(
			calcomCreateBooking(CFG, {
				start: "2026-07-07T09:00:00.000Z",
				name: "Ada",
				email: "ada@example.com",
			}),
		).rejects.toThrow("the scheduling service could not be reached");
	});
});
