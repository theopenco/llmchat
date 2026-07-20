import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// REAL `ai` + `@ai-sdk/react` (unlike the other widget tests): this test proves
// what the live transport actually POSTs to /v1/chat — the useChat state only
// ever holds the visitor's turns + streamed replies, so admin/system rows from
// the polled feed (a separate state, merged for display only) never appear in
// the request history. The api rejects such roles at validation, so this is
// the transport-side half of that contract.
const mockConfig = vi.hoisted(() => ({
	current: {
		showBranding: false,
		privacyPolicyUrl: null as string | null,
		suggestedQuestions: [] as string[],
		collectIdentity: false,
		welcomeMessage: null as string | null,
	},
}));
vi.mock("./widget-config", () => ({
	useWidgetConfig: () => mockConfig.current,
}));

import { Widget } from "./widget";

interface RecordedCall {
	url: string;
	body: Record<string, unknown> | null;
}

// Persisted thread holding every feed role — the dashboard-side ones (admin
// reply, system escalation marker) must render in the thread but never be
// echoed back to POST /v1/chat.
const FEED = [
	{ id: "m_user", role: "user", content: "hi", sequence: 1, rating: null },
	{
		id: "m_assistant",
		role: "assistant",
		content: "hello!",
		sequence: 2,
		rating: null,
	},
	{
		id: "m_system",
		role: "system",
		content: "Visitor requested a human operator",
		sequence: 3,
		rating: null,
	},
	{
		id: "m_admin",
		role: "admin",
		content: "operator here",
		sequence: 4,
		rating: null,
	},
];

function stubApi() {
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
					messages: FEED,
				});
			}
			if (url.includes("/v1/chat")) {
				return new Response(
					`data: ${JSON.stringify({ type: "start" })}\n\n` +
						`data: ${JSON.stringify({ type: "text-start", id: "t1" })}\n\n` +
						`data: ${JSON.stringify({ type: "text-delta", id: "t1", delta: "sure." })}\n\n` +
						`data: ${JSON.stringify({ type: "text-end", id: "t1" })}\n\n` +
						`data: ${JSON.stringify({ type: "finish" })}\n\n` +
						"data: [DONE]\n\n",
					{
						headers: {
							"content-type": "text/event-stream",
							"x-vercel-ai-ui-message-stream": "v1",
						},
					},
				);
			}
			return Response.json({ ok: true });
		}),
	);
	return calls;
}

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("LiveWidget chat transport — history role allowlist", () => {
	it("POSTs only user/assistant history even when the polled feed holds admin + system rows", async () => {
		const calls = stubApi();
		const user = userEvent.setup();
		render(
			<Widget
				widgetMode="live"
				projectKey="pk_a"
				apiUrl="http://x"
				brandColor="#4f46e5"
				mode="inline"
			/>,
		);

		// The merged display shows the operator reply from the feed — so the
		// assertion below is dropping rows that really were in client state.
		await screen.findByText("operator here");

		await user.type(screen.getByLabelText("Message"), "one more question");
		await user.click(screen.getByLabelText("Send message"));

		await waitFor(() =>
			expect(calls.some((c) => c.url.includes("/v1/chat"))).toBe(true),
		);
		const chat = calls.find((c) => c.url.includes("/v1/chat"))!;
		const history = chat.body!.messages as { role: string }[];

		expect(history.length).toBeGreaterThan(0);
		expect(
			history.every((m) => m.role === "user" || m.role === "assistant"),
		).toBe(true);
	});
});
