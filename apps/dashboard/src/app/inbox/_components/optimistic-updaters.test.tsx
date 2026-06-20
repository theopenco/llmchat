import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useOptimisticMutation } from "@/lib/optimistic";

import { appendOptimisticReply } from "./optimistic-updaters";
import type { Conversation, Message } from "./types";

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

function thread(messages: Message[]) {
	return { conversation: { id: "c1" } as Conversation, messages };
}

const REPLY = {
	tempId: "temp-1",
	content: "On it!",
	createdAt: "2026-06-16T06:00:00.000Z",
};

describe("appendOptimisticReply", () => {
	it("appends an admin message with the next sequence, immutably", () => {
		const prev = thread([
			msg({ sequence: 1 }),
			msg({ role: "assistant", sequence: 2 }),
		]);
		const next = appendOptimisticReply(prev, REPLY) as ReturnType<
			typeof thread
		>;

		expect(next.messages).toHaveLength(3);
		const added = next.messages[2];
		expect(added).toMatchObject({
			id: "temp-1",
			role: "admin",
			content: "On it!",
			sequence: 3,
		});
		// Original thread is untouched.
		expect(prev.messages).toHaveLength(2);
	});

	it("starts at sequence 1 for an empty thread and is undefined-safe", () => {
		const next = appendOptimisticReply(thread([]), REPLY) as ReturnType<
			typeof thread
		>;
		expect(next.messages[0].sequence).toBe(1);
		expect(appendOptimisticReply(undefined, REPLY)).toBeUndefined();
	});
});

describe("optimistic reply rollback", () => {
	it("restores the thread when the send fails", async () => {
		const client = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		const key = ["thread", "p1", "c1"];
		const seed = thread([msg({ content: "hi", sequence: 1 })]);
		client.setQueryData(key, seed);

		const { result } = renderHook(
			() =>
				useOptimisticMutation<typeof REPLY>({
					queryKey: key,
					apply: (prev, vars) => appendOptimisticReply(prev, vars),
					mutationFn: () => Promise.reject(new Error("network down")),
				}),
			{
				wrapper: ({ children }: { children: ReactNode }) =>
					createElement(QueryClientProvider, { client }, children),
			},
		);

		act(() => result.current.mutate(REPLY));
		await waitFor(() => expect(result.current.isError).toBe(true));

		// The optimistic admin bubble is gone — back to the single seeded message.
		const data = client.getQueryData(key) as ReturnType<typeof thread>;
		expect(data.messages).toHaveLength(1);
		expect(data.messages[0].content).toBe("hi");
	});
});
