import {
	QueryClient,
	QueryClientProvider,
	useQuery,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useOptimisticMutation } from "@/lib/optimistic";

import {
	addTagToConversation,
	mergeConversationPages,
	type ConversationPage,
} from "./conversation-list";
import type { Conversation, Tag } from "./types";

const TAG: Tag = { id: "t1", name: "Billing", color: "#6366f1" };

function conv(tags: Tag[]): Conversation {
	return {
		id: "c1",
		clientId: "c",
		name: "Bob",
		email: null,
		ipAddress: null,
		userAgent: null,
		messageCount: 1,
		escalatedAt: null,
		archivedAt: null,
		createdAt: "2026-06-16T05:00:00.000Z",
		updatedAt: "2026-06-16T05:00:00.000Z",
		csatRating: null,
		tags,
	};
}

function page(tags: Tag[]): ConversationPage {
	return { conversations: [conv(tags)], nextCursor: null };
}

// The head (5s poll) and list query keys the inbox uses — both share the
// `["conversations", "p1"]` prefix the optimistic mutation writes to.
const HEAD_KEY = ["conversations", "p1", "head", "", false, ""];
const LIST_KEY = ["conversations", "p1", "list", "", false, ""];

function wrapper(client: QueryClient) {
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

/**
 * Reproduces the inbox's tag wiring with the REAL hooks: a head query (the poll)
 * + a list query, the shared optimistic mutation (attach), and the render-time
 * merge. `server` is the source both queries fetch from — the attach mutationFn
 * persists the tag into it (modelling the POST succeeding server-side) so a
 * later poll/invalidation sees the tag, exactly like production.
 */
function useInboxTagSlice(server: {
	head: ConversationPage;
	list: ConversationPage;
}) {
	const head = useQuery({
		queryKey: HEAD_KEY,
		queryFn: async () => server.head,
	});
	const list = useQuery({
		queryKey: LIST_KEY,
		queryFn: async () => server.list,
	});
	const attach = useOptimisticMutation<{ id: string; tag: Tag }>({
		queryKey: ["conversations", "p1"],
		invalidateKey: HEAD_KEY,
		// The exact updater the inbox page uses for an optimistic attach.
		apply: (prev, vars) => addTagToConversation(prev, vars.id, vars.tag),
		mutationFn: async () => {
			// The attach POST persists the tag, so any subsequent fetch returns it
			// (identical serialization to the list — a Tag[] on the conversation).
			server.head = page([TAG]);
			server.list = page([TAG]);
			return { ok: true };
		},
	});
	const merged = mergeConversationPages([
		head.data?.conversations,
		list.data?.conversations,
	]);
	return { head, attach, merged };
}

describe("optimistic tag attach survives the head/poll refetch", () => {
	it("keeps the chip on the row AND the open-thread conversation after a poll", async () => {
		const client = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		// Server starts with the conversation untagged.
		const server = { head: page([]), list: page([]) };

		const { result } = renderHook(() => useInboxTagSlice(server), {
			wrapper: wrapper(client),
		});

		// Both queries load: the conversation has no tags yet.
		await waitFor(() => expect(result.current.merged).toHaveLength(1));
		expect(result.current.merged[0]!.tags).toEqual([]);

		// Attach a tag optimistically.
		act(() => result.current.attach.mutate({ id: "c1", tag: TAG }));

		// The chip appears immediately (before any refetch).
		await waitFor(() => expect(result.current.merged[0]!.tags).toEqual([TAG]));

		// Let the mutation settle — onSettled invalidates the head, triggering a
		// refetch (the same path a 5s poll takes). The server now returns the tag.
		await waitFor(() => expect(result.current.attach.isSuccess).toBe(true));

		// Explicit poll refetch on top, to be unambiguous.
		await act(async () => {
			await result.current.head.refetch();
		});

		// The head poll returned the tag (identical serialization), so the chip
		// PERSISTS — the poll never blanks the optimistically-added tag.
		expect(result.current.head.data?.conversations[0]!.tags).toEqual([TAG]);

		// `merged` is what the LIST rows render from, and `merged.find(id)` is the
		// `selectedConv` the open THREAD reads its chips from — both still carry it.
		const row = result.current.merged[0]!;
		const selectedConv = result.current.merged.find((c) => c.id === "c1")!;
		expect(row.tags).toEqual([TAG]);
		expect(selectedConv.tags).toEqual([TAG]);
	});

	it("a poll that returns the tag does not produce a duplicate chip", async () => {
		const client = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		const server = { head: page([]), list: page([]) };
		const { result } = renderHook(() => useInboxTagSlice(server), {
			wrapper: wrapper(client),
		});
		await waitFor(() => expect(result.current.merged).toHaveLength(1));

		act(() => result.current.attach.mutate({ id: "c1", tag: TAG }));
		await waitFor(() => expect(result.current.attach.isSuccess).toBe(true));
		await act(async () => {
			await result.current.head.refetch();
		});

		// Optimistic write + server poll both carry the tag, but the conversation
		// shows it ONCE (merge dedupes the row; the tag isn't double-applied).
		expect(result.current.merged).toHaveLength(1);
		expect(result.current.merged[0]!.tags).toEqual([TAG]);
	});
});
