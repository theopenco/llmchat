import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	Composer,
	Input,
	Messages,
	Panel,
	Root,
	Submit,
	Trigger,
} from "../primitives/primitives";

import type { ServerMessage } from "../protocol/api";
import type { WidgetConfig } from "../types";

const CONFIG: WidgetConfig = { showBranding: true, privacyPolicyUrl: null };
const API = "https://api.test";

// A persisted thread holding EVERY role the feed can carry — including the
// dashboard-side ones (admin reply, system escalation marker) that must never
// be echoed back to POST /v1/chat as history (the api 400s them).
const FEED: ServerMessage[] = [
	{ id: "m_user", role: "user", content: "hi", sequence: 1 },
	{ id: "m_assistant", role: "assistant", content: "hello!", sequence: 2 },
	{
		id: "m_system",
		role: "system",
		content: "Visitor requested a human operator",
		sequence: 3,
	},
	{ id: "m_admin", role: "admin", content: "operator here", sequence: 4 },
];

interface RecordedCall {
	url: string;
	body: Record<string, unknown> | null;
}

function stubApi(feed: ServerMessage[]) {
	const calls: RecordedCall[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			calls.push({
				url,
				body: init?.body ? (JSON.parse(String(init.body)) as never) : null,
			});
			if (url.includes("/v1/messages")) {
				return Response.json({
					conversationId: "c1",
					csatRating: null,
					escalatedAt: null,
					archivedAt: null,
					messages: feed,
				});
			}
			if (url.includes("/v1/chat")) {
				return new Response(
					`data: ${JSON.stringify({ type: "text-start", id: "t1" })}\n\n` +
						`data: ${JSON.stringify({ type: "text-delta", id: "t1", delta: "sure." })}\n\n` +
						"data: [DONE]\n\n",
					{ headers: { "content-type": "text/event-stream" } },
				);
			}
			if (url.includes("/v1/config/")) {
				return Response.json(CONFIG);
			}
			return Response.json({ ok: true });
		}),
	);
	return calls;
}

function Harness() {
	return (
		<Root apiKey="pk_test" apiUrl={API} initialConfig={CONFIG}>
			<Trigger>Open</Trigger>
			<Panel>
				<Messages>{(m) => <span>{m.content}</span>}</Messages>
				<Composer>
					<Input />
					<Submit>Send</Submit>
				</Composer>
			</Panel>
		</Root>
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("widget-rsc chat transport — history role allowlist", () => {
	it("POSTs only user/assistant history even when the feed holds admin + system rows", async () => {
		const calls = stubApi(FEED);
		const user = userEvent.setup();
		render(<Harness />);
		await user.click(screen.getByRole("button", { name: "Open" }));
		await screen.findByRole("dialog");
		// The full feed (incl. the admin reply) rendered — so the filter below is
		// dropping rows that really were in client state, not rows that never loaded.
		await screen.findByText("operator here");

		await user.type(screen.getByRole("textbox"), "one more question");
		await user.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() =>
			expect(calls.some((c) => c.url.includes("/v1/chat"))).toBe(true),
		);
		const chat = calls.find((c) => c.url.includes("/v1/chat"))!;
		const history = chat.body!.messages as { id: string; role: string }[];

		// Every entry the api receives is user/assistant — nothing else survives
		// the provider's history filter (client/provider.tsx).
		expect(history.length).toBeGreaterThan(0);
		expect(
			history.every((m) => m.role === "user" || m.role === "assistant"),
		).toBe(true);
		// And specifically: the dashboard-side rows were dropped, the real
		// conversation turns kept.
		const ids = history.map((m) => m.id);
		expect(ids).not.toContain("m_system");
		expect(ids).not.toContain("m_admin");
		expect(ids).toContain("m_user");
		expect(ids).toContain("m_assistant");
	});
});
