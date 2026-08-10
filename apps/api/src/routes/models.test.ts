import { beforeEach, describe, expect, it, vi } from "vitest";

import { models } from "./models";

vi.mock("@/auth", () => ({
	createAuth: () => ({
		api: {
			getSession: async ({
				headers,
				returnHeaders,
			}: {
				headers: Headers;
				returnHeaders?: boolean;
			}) => {
				const id = headers.get("x-test-user");
				const session = id ? { user: { id } } : null;
				// Mirror better-auth's real contract: returnHeaders wraps the session in
				// { headers, response } (requireSession forwards refreshed cookies from it).
				return returnHeaders
					? { headers: new Headers(), response: session }
					: session;
			},
		},
	}),
}));

const GATEWAY_BODY = JSON.stringify({
	data: [{ id: "gpt-5.4-mini", name: "GPT-5.4 Mini" }],
});

/** In-memory STATE double; `broken` simulates an unavailable store. */
function fakeState(broken = false) {
	const store = new Map<string, string>();
	return {
		store,
		get: async (key: string) => {
			if (broken) throw new Error("state down");
			return store.get(key) ?? null;
		},
		set: async (key: string, value: string) => {
			if (broken) throw new Error("state down");
			store.set(key, value);
		},
	};
}

function env(state: ReturnType<typeof fakeState>) {
	return {
		vars: { LLMGATEWAY_BASE_URL: "https://gw.test/v1" },
		STATE: state,
	} as unknown as Parameters<typeof models.request>[2];
}

async function get(e: Parameters<typeof models.request>[2], signedIn = true) {
	const res = await models.request(
		"/models",
		{ headers: signedIn ? { "x-test-user": "u1" } : {} },
		e,
	);
	return res;
}

beforeEach(() => {
	vi.restoreAllMocks();
});

describe("GET /models", () => {
	it("requires a session", async () => {
		const res = await get(env(fakeState()), false);
		expect(res.status).toBe(401);
	});

	it("fetches from the gateway, returns the payload, and caches it", async () => {
		const state = fakeState();
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(GATEWAY_BODY, { status: 200 }));

		const res = await get(env(state));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		expect(await res.json()).toEqual(JSON.parse(GATEWAY_BODY));
		expect(fetchSpy).toHaveBeenCalledWith("https://gw.test/v1/models");
		expect(state.store.has("cache:gateway-models")).toBe(true);
	});

	it("serves from the cache without hitting the gateway while fresh", async () => {
		const state = fakeState();
		state.store.set(
			"cache:gateway-models",
			JSON.stringify({
				body: GATEWAY_BODY,
				expiresAt: Math.floor(Date.now() / 1000) + 60,
			}),
		);
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const res = await get(env(state));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(JSON.parse(GATEWAY_BODY));
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("serves a stale cache entry when the gateway fails (stale-if-error)", async () => {
		const state = fakeState();
		state.store.set(
			"cache:gateway-models",
			JSON.stringify({
				body: GATEWAY_BODY,
				expiresAt: Math.floor(Date.now() / 1000) - 60, // expired
			}),
		);
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("nope", { status: 503 }),
		);

		const res = await get(env(state));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(JSON.parse(GATEWAY_BODY));
	});

	it("502s when the gateway fails and there is no cache", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));
		const res = await get(env(fakeState()));
		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({ error: "models_unavailable" });
	});

	it("does not forward or cache a 200 that is not the models envelope", async () => {
		const state = fakeState();
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ error: "maintenance" }), { status: 200 }),
		);

		const res = await get(env(state));
		expect(res.status).toBe(502);
		expect(state.store.size).toBe(0);
	});

	it("still proxies when the STATE store is unavailable", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(GATEWAY_BODY, { status: 200 }),
		);
		const res = await get(env(fakeState(true)));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(JSON.parse(GATEWAY_BODY));
	});
});
