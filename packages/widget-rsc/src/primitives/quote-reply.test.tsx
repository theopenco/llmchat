import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	Composer,
	Input,
	Messages,
	Panel,
	QuotedMessage,
	ReplyButton,
	ReplyingTo,
	Root,
	Submit,
	Trigger,
} from "./primitives";

import type { ServerMessage } from "../protocol/api";
import type { WidgetConfig } from "../types";

const CONFIG: WidgetConfig = { showBranding: true, privacyPolicyUrl: null };
const API = "https://api.test";

const AGENT: ServerMessage = {
	id: "m_agent",
	role: "assistant",
	content: "Your order ships on Tuesday.",
	sequence: 1,
};

interface RecordedCall {
	url: string;
	body: Record<string, unknown> | null;
}

/** Feed-seeded fetch mock: the persisted thread already holds one agent reply. */
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
						`data: ${JSON.stringify({ type: "text-delta", id: "t1", delta: "The blue one." })}\n\n` +
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

/** The provider only polls the persisted feed while the panel is open, so the
 * harness opens it — same as a real embed. */
function Harness() {
	return (
		<Root apiKey="pk_test" apiUrl={API} initialConfig={CONFIG}>
			<Trigger>Open</Trigger>
			<Panel>
				<Messages>
					{(m) => (
						<div>
							<QuotedMessage message={m} />
							<span>{m.content}</span>
							<ReplyButton message={m}>Reply</ReplyButton>
						</div>
					)}
				</Messages>
				<ReplyingTo />
				<Composer>
					<Input />
					<Submit>Send</Submit>
				</Composer>
			</Panel>
		</Root>
	);
}

/** Render the widget with its panel already open (the feed loads on open). */
async function open(user: ReturnType<typeof userEvent.setup>) {
	render(<Harness />);
	await user.click(screen.getByRole("button", { name: "Open" }));
	await screen.findByRole("dialog");
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("widget-rsc quote-reply", () => {
	it("sends replyToMessageId at the TOP LEVEL of the chat request", async () => {
		const calls = stubApi([AGENT]);
		const user = userEvent.setup();
		await open(user);

		// Reply to the agent's persisted message (its DB id — not an AI SDK id).
		await user.click(await screen.findByRole("button", { name: "Reply" }));

		// The "Replying to:" bar appears with the quoted text.
		await waitFor(() =>
			expect(
				document.querySelector('[data-part="replying-to"]'),
			).toBeInTheDocument(),
		);

		await user.type(screen.getByRole("textbox"), "which one?");
		await user.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() =>
			expect(calls.some((c) => c.url.includes("/v1/chat"))).toBe(true),
		);
		const chat = calls.find((c) => c.url.includes("/v1/chat"))!;
		expect(chat.body).toMatchObject({
			projectKey: "pk_test",
			replyToMessageId: AGENT.id,
		});

		// Consumed: the bar clears on send, so the NEXT turn isn't silently sent as
		// another reply to the same message.
		await waitFor(() =>
			expect(
				document.querySelector('[data-part="replying-to"]'),
			).not.toBeInTheDocument(),
		);
	});

	it("omits replyToMessageId entirely on a plain (unquoted) turn", async () => {
		const calls = stubApi([AGENT]);
		const user = userEvent.setup();
		await open(user);

		await user.type(await screen.findByRole("textbox"), "hello");
		await user.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() =>
			expect(calls.some((c) => c.url.includes("/v1/chat"))).toBe(true),
		);
		const chat = calls.find((c) => c.url.includes("/v1/chat"))!;
		expect(chat.body).not.toHaveProperty("replyToMessageId");
	});

	it("renders the quote chip on a persisted reply, resolved from the thread", async () => {
		stubApi([
			AGENT,
			{
				id: "m_reply",
				role: "user",
				content: "which one?",
				sequence: 2,
				replyToMessageId: AGENT.id,
			},
		]);
		await open(userEvent.setup());

		await waitFor(() =>
			expect(document.querySelector('[data-part="quote"]')).toBeInTheDocument(),
		);
		const chip = document.querySelector('[data-part="quote"]')!;
		expect(chip).toHaveAttribute("data-resolved", "true");
		expect(chip).toHaveAttribute("data-role", "assistant");
		expect(chip.textContent).toBe(AGENT.content);
	});

	it("falls back to a neutral chip when the quoted message isn't in the thread", async () => {
		stubApi([
			{
				id: "m_reply",
				role: "user",
				content: "which one?",
				sequence: 2,
				replyToMessageId: "paged_out_or_deleted",
			},
		]);
		await open(userEvent.setup());

		await waitFor(() =>
			expect(document.querySelector('[data-part="quote"]')).toBeInTheDocument(),
		);
		const chip = document.querySelector('[data-part="quote"]')!;
		expect(chip).toHaveAttribute("data-resolved", "false");
		expect(chip.textContent).toBe("earlier message");
	});

	it("offers no Reply affordance on internal system rows", async () => {
		stubApi([
			AGENT,
			{
				id: "m_sys",
				role: "system",
				content: "Visitor requested a human operator",
				sequence: 2,
			},
		]);
		await open(userEvent.setup());

		// `Messages` filters system rows out of the thread entirely, so there is
		// exactly one Reply button — the agent's.
		await waitFor(() =>
			expect(screen.getAllByRole("button", { name: "Reply" })).toHaveLength(1),
		);
		expect(
			screen.queryByText("Visitor requested a human operator"),
		).not.toBeInTheDocument();
	});
});
