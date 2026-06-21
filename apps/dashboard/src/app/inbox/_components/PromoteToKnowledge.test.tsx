import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MessageThread, type KnowledgeContext } from "./MessageThread";
import type { Message } from "./types";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
	toast: {
		success: (m: string) => toastSuccess(m),
		error: (m: string) => toastError(m),
	},
}));

function msg(overrides: Partial<Message>): Message {
	return {
		id: crypto.randomUUID(),
		role: "user",
		content: "hello",
		sequence: 1,
		createdAt: "2026-06-16T05:00:00.000Z",
		...overrides,
	};
}

const knowledge: KnowledgeContext = {
	projectId: "p1",
	projectName: "Acme Support",
	workspaceId: "ws_1",
};

function renderThread(messages: Message[], k?: KnowledgeContext) {
	const qc = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={qc}>
			<MessageThread messages={messages} knowledge={k} />
		</QueryClientProvider>,
	);
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
	toastSuccess.mockClear();
	toastError.mockClear();
	fetchMock = vi.fn(async () => ({
		ok: true,
		status: 200,
		json: async () => ({ source: { id: "src_new", kind: "qa" } }),
		text: async () => "",
	}));
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const addBtn = () =>
	screen.queryByRole("button", { name: /add to knowledge/i });

describe("Add to knowledge action", () => {
	it("shows the action only on admin replies, and only when knowledge is provided", () => {
		const messages = [
			msg({
				role: "user",
				content: "How do I reset my password?",
				sequence: 1,
			}),
			msg({ role: "assistant", content: "I can help with that.", sequence: 2 }),
			msg({ role: "admin", content: "Go to Settings → Reset.", sequence: 3 }),
		];
		// Without knowledge context: no action anywhere.
		const { unmount } = renderThread(messages);
		expect(addBtn()).not.toBeInTheDocument();
		unmount();

		// With knowledge: exactly one action (on the single admin reply).
		renderThread(messages, knowledge);
		expect(
			screen.getAllByRole("button", { name: /add to knowledge/i }),
		).toHaveLength(1);
	});

	it("opens a dialog prefilled with the preceding visitor question + the reply", async () => {
		const user = userEvent.setup();
		renderThread(
			[
				msg({
					role: "user",
					content: "How do I reset my password?",
					sequence: 1,
				}),
				msg({ role: "admin", content: "Go to Settings → Reset.", sequence: 2 }),
			],
			knowledge,
		);
		await user.click(addBtn()!);

		expect(screen.getByLabelText("Question")).toHaveValue(
			"How do I reset my password?",
		);
		expect(screen.getByLabelText("Answer")).toHaveValue(
			"Go to Settings → Reset.",
		);
		// Notes which agent it adds to (positioning: "agent", never "chatbot").
		expect(screen.getByText("Acme Support")).toBeInTheDocument();
	});

	it("promotes on confirm: POSTs the right body, toasts, and shows the badge", async () => {
		const user = userEvent.setup();
		renderThread(
			[
				msg({
					role: "user",
					content: "How do I reset my password?",
					sequence: 1,
				}),
				msg({ role: "admin", content: "Go to Settings → Reset.", sequence: 2 }),
			],
			knowledge,
		);
		await user.click(addBtn()!);
		await user.click(
			screen.getByRole("button", { name: /^add to knowledge$/i }),
		);

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toContain("/api/projects/p1/sources/promote");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body)).toEqual({
			messageId: expect.any(String),
			question: "How do I reset my password?",
			answer: "Go to Settings → Reset.",
		});
		expect(init.headers["x-workspace-id"]).toBe("ws_1");

		await waitFor(() =>
			expect(toastSuccess).toHaveBeenCalledWith(
				"Added to your agent's knowledge",
			),
		);
		// The action collapses into a quiet confirmation badge.
		await screen.findByText("In knowledge");
		expect(addBtn()).not.toBeInTheDocument();
	});

	it("omits a blank question so the server derives it", async () => {
		const user = userEvent.setup();
		// Admin reply with NO preceding visitor message → empty default question.
		renderThread(
			[
				msg({
					role: "admin",
					content: "Welcome! Ask me anything.",
					sequence: 1,
				}),
			],
			knowledge,
		);
		await user.click(addBtn()!);
		expect(screen.getByLabelText("Question")).toHaveValue("");
		await user.click(
			screen.getByRole("button", { name: /^add to knowledge$/i }),
		);

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toEqual({
			messageId: expect.any(String),
			answer: "Welcome! Ask me anything.",
		});
		expect(body).not.toHaveProperty("question");
	});

	it("keeps the dialog open and toasts on failure", async () => {
		fetchMock.mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: async () => ({ error: "boom" }),
			text: async () => '{"error":"boom"}',
		});
		const user = userEvent.setup();
		renderThread(
			[msg({ role: "admin", content: "Try this.", sequence: 1 })],
			knowledge,
		);
		await user.click(addBtn()!);
		await user.click(
			screen.getByRole("button", { name: /^add to knowledge$/i }),
		);

		await waitFor(() => expect(toastError).toHaveBeenCalled());
		// No badge — still promotable.
		expect(screen.queryByText("In knowledge")).not.toBeInTheDocument();
	});
});
