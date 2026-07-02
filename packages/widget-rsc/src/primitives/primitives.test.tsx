import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	Branding,
	Composer,
	EscalateButton,
	Input,
	Messages,
	Panel,
	Root,
	Submit,
	Trigger,
} from "./primitives";

import type { WidgetConfig } from "../types";

const CONFIG: WidgetConfig = { showBranding: true, privacyPolicyUrl: null };
const API = "https://api.test";

interface RecordedCall {
	url: string;
	body: Record<string, unknown> | null;
}

/** Route-aware fetch mock covering every /v1 endpoint the provider hits. */
function stubApi({ deltas = ["Our pricing starts at $29."] } = {}) {
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
					conversationId: null,
					csatRating: null,
					escalatedAt: null,
					archivedAt: null,
					messages: [],
				});
			}
			if (url.includes("/v1/chat")) {
				const sse =
					`data: ${JSON.stringify({ type: "text-start", id: "t1" })}\n\n` +
					deltas
						.map(
							(d) =>
								`data: ${JSON.stringify({ type: "text-delta", id: "t1", delta: d })}\n\n`,
						)
						.join("") +
					"data: [DONE]\n\n";
				return new Response(sse, {
					headers: { "content-type": "text/event-stream" },
				});
			}
			if (url.includes("/v1/escalate")) {
				return Response.json({ ok: true, summary: "We'll get back to you." });
			}
			if (url.includes("/v1/config/")) {
				return Response.json(CONFIG);
			}
			return Response.json({ ok: true });
		}),
	);
	return calls;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("Trigger + Panel", () => {
	it("toggles the panel with ARIA state and closes on Escape", async () => {
		stubApi();
		const user = userEvent.setup();
		render(
			<Root apiKey="pk_test" apiUrl={API} initialConfig={CONFIG}>
				<Trigger>Need help?</Trigger>
				<Panel>panel body</Panel>
			</Root>,
		);
		const trigger = screen.getByRole("button", { name: "Need help?" });
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

		await user.click(trigger);
		const panel = await screen.findByRole("dialog", { name: "Support chat" });
		expect(panel).toHaveAttribute("data-state", "open");
		expect(trigger).toHaveAttribute("aria-expanded", "true");

		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	});
});

describe("Composer flow", () => {
	function Harness(props: { escalationThreshold?: number }) {
		return (
			<Root
				apiKey="pk_test"
				apiUrl={API}
				initialConfig={CONFIG}
				defaultOpen
				escalationThreshold={props.escalationThreshold}
			>
				<Panel>
					<Messages />
					<EscalateButton>Talk to a human</EscalateButton>
					<Composer>
						<Input />
						<Submit>Send</Submit>
					</Composer>
					<Branding />
				</Panel>
			</Root>
		);
	}

	it("sends the draft to /v1/chat and streams the reply", async () => {
		const calls = stubApi();
		const user = userEvent.setup();
		render(<Harness />);

		const input = screen.getByRole("textbox", { name: "Message" });
		const send = screen.getByRole("button", { name: "Send" });
		expect(send).toBeDisabled(); // empty draft

		await user.type(input, "What is pricing?");
		expect(send).toBeEnabled();
		await user.click(send);

		// Optimistic user bubble, then the streamed assistant reply.
		expect(await screen.findByText("What is pricing?")).toBeInTheDocument();
		expect(
			await screen.findByText("Our pricing starts at $29."),
		).toBeInTheDocument();
		expect(input).toHaveValue(""); // draft cleared

		const chat = calls.find((c) => c.url === `${API}/v1/chat`);
		expect(chat).toBeDefined();
		expect(chat!.body).toMatchObject({ projectKey: "pk_test" });
		expect(chat!.body!.clientId).toBeTruthy();
		const messages = chat!.body!.messages as {
			role: string;
			parts: { type: string; text: string }[];
		}[];
		expect(messages.at(-1)).toMatchObject({
			role: "user",
			parts: [{ type: "text", text: "What is pricing?" }],
		});
	});

	it("reveals EscalateButton at the threshold and hides it after escalating", async () => {
		const calls = stubApi();
		const user = userEvent.setup();
		render(<Harness escalationThreshold={1} />);

		expect(
			screen.queryByRole("button", { name: "Talk to a human" }),
		).not.toBeInTheDocument();

		await user.type(screen.getByRole("textbox", { name: "Message" }), "help");
		await user.click(screen.getByRole("button", { name: "Send" }));
		await screen.findByText("help");

		const escalateButton = await screen.findByRole("button", {
			name: "Talk to a human",
		});
		await user.click(escalateButton);

		await waitFor(() =>
			expect(calls.some((c) => c.url === `${API}/v1/escalate`)).toBe(true),
		);
		// Escalated conversations can't re-fire /v1/escalate.
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Talk to a human" }),
			).not.toBeInTheDocument(),
		);
	});
});

describe("Branding", () => {
	it("renders the plan-gated attribution when the server allows hiding is false", () => {
		stubApi();
		render(
			<Root apiKey="pk_test" apiUrl={API} initialConfig={CONFIG}>
				<Branding />
			</Root>,
		);
		const link = screen.getByRole("link", {
			name: "Powered by Clanker Support",
		});
		expect(link).toHaveAttribute(
			"href",
			expect.stringContaining("clankersupport.com"),
		);
	});

	it("renders nothing when the server hides branding (paid plan)", () => {
		stubApi();
		render(
			<Root
				apiKey="pk_test"
				apiUrl={API}
				initialConfig={{ showBranding: false, privacyPolicyUrl: null }}
			>
				<Branding />
			</Root>,
		);
		expect(
			screen.queryByRole("link", { name: "Powered by Clanker Support" }),
		).not.toBeInTheDocument();
	});
});
