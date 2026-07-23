import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";

import { ClankerClient } from "./client.js";
import { createServer } from "./server.js";

function jsonResponse(body: unknown) {
	return new Response(JSON.stringify(body), { status: 200 });
}

function signInResponse() {
	const res = jsonResponse({ user: { id: "u1" } });
	res.headers.append("set-cookie", "better-auth.session_token=tok; Path=/");
	return res;
}

/** Boot the real server over an in-memory transport with a mocked HTTP layer —
 * exercises the full MCP round trip (list tools, call tool, error shaping). */
async function connect(fetchMock: typeof fetch) {
	const clanker = new ClankerClient(
		{
			apiUrl: "http://api.test",
			email: "op@example.com",
			password: "pw",
			workspaceId: "ws1",
		},
		fetchMock,
	);
	const server = createServer(clanker);
	const client = new Client({ name: "test", version: "0.0.0" });
	const [a, b] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(a), client.connect(b)]);
	return client;
}

describe("clanker-support MCP server", () => {
	it("exposes the operator tool surface", async () => {
		const client = await connect(vi.fn<typeof fetch>());
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name).sort()).toEqual([
			"add_internal_note",
			"add_knowledge_source",
			"conversation_stats",
			"get_conversation",
			"list_conversations",
			"list_knowledge_sources",
			"list_projects",
			"list_workspaces",
			"reply_to_conversation",
			"search",
		]);
	});

	it("calls a tool end-to-end and returns the API payload", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(signInResponse())
			.mockResolvedValueOnce(
				jsonResponse({ conversations: [{ id: "c1" }], nextCursor: null }),
			);
		const client = await connect(fetchMock);

		const result = await client.callTool({
			name: "list_conversations",
			arguments: { projectId: "p1", status: "escalated" },
		});

		const content = result.content as { type: string; text: string }[];
		expect(result.isError).toBeFalsy();
		expect(JSON.parse(content[0].text).conversations[0].id).toBe("c1");
		const calledUrl = new URL(String(fetchMock.mock.calls[1][0]));
		expect(calledUrl.searchParams.get("status")).toBe("escalated");
	});

	it("routes add_knowledge_source by kind and validates required fields", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(signInResponse())
			.mockResolvedValueOnce(jsonResponse({ source: { id: "s1" } }));
		const client = await connect(fetchMock);

		const ok = await client.callTool({
			name: "add_knowledge_source",
			arguments: { projectId: "p1", kind: "qa", question: "Q?", answer: "A." },
		});
		expect(ok.isError).toBeFalsy();
		expect(String(fetchMock.mock.calls[1][0])).toBe(
			"http://api.test/api/projects/p1/sources/qa",
		);

		const bad = await client.callTool({
			name: "add_knowledge_source",
			arguments: { projectId: "p1", kind: "url" },
		});
		expect(bad.isError).toBe(true);
		expect((bad.content as { text: string }[])[0].text).toMatch(
			/requires `url`/,
		);
	});

	it("shapes API failures as isError results, not protocol errors", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(signInResponse())
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: "payment required" }), {
					status: 402,
				}),
			);
		const client = await connect(fetchMock);

		const result = await client.callTool({
			name: "list_projects",
			arguments: {},
		});

		expect(result.isError).toBe(true);
		expect((result.content as { text: string }[])[0].text).toMatch(/402/);
	});
});
