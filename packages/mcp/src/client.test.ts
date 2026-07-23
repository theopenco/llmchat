import { describe, expect, it, vi } from "vitest";

import { ClankerApiError, ClankerClient } from "./client.js";

import type { ClankerConfig } from "./config.js";

const CFG: ClankerConfig = {
	apiUrl: "http://api.test",
	email: "op@example.com",
	password: "hunter22",
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "content-type": "application/json" },
		...init,
	});
}

function signInResponse() {
	const res = jsonResponse({ user: { id: "u1" } });
	res.headers.append(
		"set-cookie",
		"better-auth.session_token=tok123; Path=/; HttpOnly",
	);
	return res;
}

describe("ClankerClient", () => {
	it("signs in lazily, replays the session cookie, and scopes to the workspace", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(signInResponse())
			.mockResolvedValueOnce(jsonResponse({ projects: [] }));
		const client = new ClankerClient({ ...CFG, workspaceId: "ws1" }, fetchMock);

		await client.listProjects();

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const [signInUrl, signInInit] = fetchMock.mock.calls[0];
		expect(String(signInUrl)).toBe("http://api.test/api/auth/sign-in/email");
		expect(JSON.parse(signInInit!.body as string)).toEqual({
			email: CFG.email,
			password: CFG.password,
		});
		const [url, init] = fetchMock.mock.calls[1];
		expect(String(url)).toBe("http://api.test/api/projects");
		const headers = init!.headers as Record<string, string>;
		expect(headers.cookie).toBe("better-auth.session_token=tok123");
		expect(headers["x-workspace-id"]).toBe("ws1");
	});

	it("resolves the workspace with the most projects when none is configured", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(signInResponse())
			.mockResolvedValueOnce(
				jsonResponse({
					workspaces: [
						{ workspace: { id: "ws-empty" }, projectCount: 0 },
						{ workspace: { id: "ws-busy" }, projectCount: 3 },
					],
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ projects: [] }));
		const client = new ClankerClient(CFG, fetchMock);

		await client.listProjects();

		const headers = fetchMock.mock.calls[2][1]!.headers as Record<
			string,
			string
		>;
		expect(headers["x-workspace-id"]).toBe("ws-busy");
	});

	it("re-authenticates once on a 401 and retries the request", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(signInResponse())
			.mockResolvedValueOnce(new Response("expired", { status: 401 }))
			.mockResolvedValueOnce(signInResponse())
			.mockResolvedValueOnce(jsonResponse({ projects: [{ id: "p1" }] }));
		const client = new ClankerClient({ ...CFG, workspaceId: "ws1" }, fetchMock);

		const data = (await client.listProjects()) as { projects: unknown[] };

		expect(data.projects).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("surfaces API errors with status and body", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(signInResponse())
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: "payment required" }), {
					status: 402,
				}),
			);
		const client = new ClankerClient({ ...CFG, workspaceId: "ws1" }, fetchMock);

		await expect(client.listProjects()).rejects.toMatchObject({
			name: "ClankerApiError",
			status: 402,
		});
	});

	it("fails clearly when sign-in is rejected", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response("nope", { status: 401 }));
		const client = new ClankerClient(CFG, fetchMock);

		await expect(client.listProjects()).rejects.toThrow(
			/sign-in failed — check CLANKER_EMAIL/,
		);
		expect(
			(await client.listProjects().catch((e: unknown) => e)) as ClankerApiError,
		).toBeInstanceOf(ClankerApiError);
	});

	it("serializes query params and drops undefined ones", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(signInResponse())
			.mockResolvedValueOnce(jsonResponse({ conversations: [] }));
		const client = new ClankerClient({ ...CFG, workspaceId: "ws1" }, fetchMock);

		await client.listConversations("p1", {
			status: "escalated",
			limit: 5,
			search: undefined,
		});

		const url = new URL(String(fetchMock.mock.calls[1][0]));
		expect(url.pathname).toBe("/api/projects/p1/conversations");
		expect(url.searchParams.get("status")).toBe("escalated");
		expect(url.searchParams.get("limit")).toBe("5");
		expect(url.searchParams.has("search")).toBe(false);
	});
});
