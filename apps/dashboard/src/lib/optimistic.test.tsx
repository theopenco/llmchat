import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { dropById, mapById, useOptimisticMutation } from "./optimistic";

function makeClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
}

function wrapperFor(client: QueryClient) {
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

describe("dropById / mapById updaters", () => {
	it("dropById removes by id, leaves the input untouched, and passes undefined through", () => {
		const prev = { conversations: [{ id: "a" }, { id: "b" }] };
		const next = dropById(prev, "conversations", "a") as typeof prev;
		expect(next.conversations).toEqual([{ id: "b" }]);
		// Immutable: the original array is not mutated.
		expect(prev.conversations).toHaveLength(2);
		// Undefined-safe: a never-loaded cache passes straight through.
		expect(dropById(undefined, "conversations", "a")).toBeUndefined();
	});

	it("mapById replaces only the matching item, immutably", () => {
		const prev = {
			projects: [
				{ id: "a", pinned: false },
				{ id: "b", pinned: false },
			],
		};
		const next = mapById<{ id: string; pinned: boolean }>(
			prev,
			"projects",
			"b",
			(p) => ({ ...p, pinned: true }),
		) as typeof prev;
		expect(next.projects).toEqual([
			{ id: "a", pinned: false },
			{ id: "b", pinned: true },
		]);
		expect(prev.projects[1].pinned).toBe(false);
		expect(mapById(undefined, "projects", "b", (p) => p)).toBeUndefined();
	});
});

describe("useOptimisticMutation", () => {
	it("applies the optimistic update immediately", async () => {
		const client = makeClient();
		const key = ["conversations", "p1", "", false];
		client.setQueryData(key, { conversations: [{ id: "a" }, { id: "b" }] });

		const { result } = renderHook(
			() =>
				useOptimisticMutation<string>({
					queryKey: ["conversations", "p1"],
					apply: (prev, id) => dropById(prev, "conversations", id),
					mutationFn: () => new Promise(() => {}), // never resolves: prove the UI doesn't wait
				}),
			{ wrapper: wrapperFor(client) },
		);

		act(() => result.current.mutate("a"));

		await waitFor(() => {
			const data = client.getQueryData(key) as {
				conversations: { id: string }[];
			};
			expect(data.conversations).toEqual([{ id: "b" }]);
		});
	});

	// Each Phase-1 call site, exercised through the real updater + the helper's
	// rollback path: an optimistic write that then fails must restore the cache.
	const ROLLBACK_CASES = [
		{
			name: "conversation archive/delete",
			key: ["conversations", "p1", "", false],
			partial: ["conversations", "p1"],
			seed: { conversations: [{ id: "a" }, { id: "b" }] },
			apply: (prev: unknown) => dropById(prev, "conversations", "a"),
		},
		{
			name: "project delete",
			key: ["projects", "w1"],
			partial: ["projects", "w1"],
			seed: { projects: [{ id: "a" }, { id: "b" }] },
			apply: (prev: unknown) => dropById(prev, "projects", "a"),
		},
		{
			name: "source delete",
			key: ["sources", "p1"],
			partial: ["sources", "p1"],
			seed: { sources: [{ id: "s1" }, { id: "s2" }] },
			apply: (prev: unknown) => dropById(prev, "sources", "s1"),
		},
		{
			name: "project pin/star toggle",
			key: ["projects", "w1"],
			partial: ["projects", "w1"],
			seed: { projects: [{ id: "a", pinned: false }] },
			apply: (prev: unknown) =>
				mapById<{ id: string; pinned: boolean }>(
					prev,
					"projects",
					"a",
					(p) => ({ ...p, pinned: true }),
				),
		},
	];

	it.each(ROLLBACK_CASES)("rolls back $name on failure", async (tc) => {
		const client = makeClient();
		client.setQueryData(tc.key, tc.seed);

		const { result } = renderHook(
			() =>
				useOptimisticMutation({
					queryKey: tc.partial,
					apply: tc.apply,
					mutationFn: () => Promise.reject(new Error("boom")),
				}),
			{ wrapper: wrapperFor(client) },
		);

		act(() => result.current.mutate(undefined));
		await waitFor(() => expect(result.current.isError).toBe(true));
		// Cache is byte-for-byte back to the pre-mutation snapshot.
		expect(client.getQueryData(tc.key)).toEqual(tc.seed);
	});

	it("invalidates only invalidateKey when narrower than queryKey", async () => {
		// The conversation list optimistically updates the wide key (head + every
		// loaded page) but must revalidate ONLY the head — never refetch all pages.
		const client = makeClient();
		const spy = vi.spyOn(client, "invalidateQueries");
		client.setQueryData(["conversations", "p1", "head"], {
			conversations: [{ id: "a" }],
		});

		const { result } = renderHook(
			() =>
				useOptimisticMutation<string>({
					queryKey: ["conversations", "p1"],
					invalidateKey: ["conversations", "p1", "head"],
					apply: (prev, id) => dropById(prev, "conversations", id),
					mutationFn: () => Promise.resolve({ ok: true }),
				}),
			{ wrapper: wrapperFor(client) },
		);

		act(() => result.current.mutate("a"));
		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		const invalidatedKeys = spy.mock.calls.map((c) => c[0]?.queryKey);
		expect(invalidatedKeys).toContainEqual(["conversations", "p1", "head"]);
		// The wide key (which would refetch the paginated "list") is never invalidated.
		expect(invalidatedKeys).not.toContainEqual(["conversations", "p1"]);
	});

	it("rolls back every cached variant of a partial key", async () => {
		const client = makeClient();
		const active = ["conversations", "p1", "", false];
		const searched = ["conversations", "p1", "refund", false];
		client.setQueryData(active, { conversations: [{ id: "a" }, { id: "b" }] });
		client.setQueryData(searched, { conversations: [{ id: "a" }] });

		const { result } = renderHook(
			() =>
				useOptimisticMutation<string>({
					queryKey: ["conversations", "p1"],
					apply: (prev, id) => dropById(prev, "conversations", id),
					mutationFn: () => Promise.reject(new Error("boom")),
				}),
			{ wrapper: wrapperFor(client) },
		);

		act(() => result.current.mutate("a"));
		await waitFor(() => expect(result.current.isError).toBe(true));

		// Both list variants are restored — the partial key spans them all.
		expect(client.getQueryData(active)).toEqual({
			conversations: [{ id: "a" }, { id: "b" }],
		});
		expect(client.getQueryData(searched)).toEqual({
			conversations: [{ id: "a" }],
		});
	});
});
