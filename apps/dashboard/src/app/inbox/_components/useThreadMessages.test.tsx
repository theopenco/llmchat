import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import { useThreadMessages } from "./useThreadMessages";

import type { Message } from "./types";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));

function range(from: number, to: number): Message[] {
	const out: Message[] = [];
	for (let s = from; s <= to; s++) {
		out.push({
			id: `m${s}`,
			role: "user",
			content: `line ${s}`,
			sequence: s,
			createdAt: "2026-06-16T05:00:00.000Z",
		});
	}
	return out;
}

const CONV = { id: "c1" };

function wrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

function paramsOf(url: string) {
	return new URLSearchParams(url.split("?")[1] ?? "");
}

beforeEach(() => vi.clearAllMocks());

describe("useThreadMessages", () => {
	it("auto-loads older pages until the search hit is in the window", async () => {
		// Latest page = seq 11..20, but the first hit is at seq 3 (an older page).
		vi.mocked(api).mockImplementation((url: string) => {
			const q = paramsOf(url);
			if (q.has("after")) {
				return Promise.resolve({
					conversation: CONV,
					messages: [],
					hasOlder: false,
				});
			}
			if (q.has("before")) {
				// The older page that contains the hit; nothing older remains.
				return Promise.resolve({
					conversation: CONV,
					messages: range(1, 10),
					hasOlder: false,
				});
			}
			// Latest page (opened with the search term).
			return Promise.resolve({
				conversation: CONV,
				messages: range(11, 20),
				hasOlder: true,
				firstHitSequence: 3,
			});
		});

		const { result } = renderHook(
			() =>
				useThreadMessages({
					projectId: "p1",
					conversationId: "c1",
					workspaceId: "w1",
					search: "refund",
				}),
			{ wrapper: wrapper() },
		);

		// The hook pages older on its own until seq 3 (the hit) is loaded.
		await waitFor(() =>
			expect(result.current.messages.some((m) => m.sequence === 3)).toBe(true),
		);
		expect(result.current.messages[0].sequence).toBe(1);
		expect(result.current.messages.at(-1)!.sequence).toBe(20);
		// It stopped once history was exhausted (no infinite loop).
		expect(result.current.hasOlder).toBe(false);

		// It actually fetched an older page via the `before` cursor.
		const calledBefore = vi
			.mocked(api)
			.mock.calls.some(([u]) => paramsOf(u as string).has("before"));
		expect(calledBefore).toBe(true);
	});

	it("leaves a short thread whole — no older page, no load-older", async () => {
		vi.mocked(api).mockImplementation((url: string) => {
			const q = paramsOf(url);
			if (q.has("after")) {
				return Promise.resolve({
					conversation: CONV,
					messages: [],
					hasOlder: false,
				});
			}
			// The whole thread fits in the latest page.
			return Promise.resolve({
				conversation: CONV,
				messages: range(1, 5),
				hasOlder: false,
				firstHitSequence: null,
			});
		});

		const { result } = renderHook(
			() =>
				useThreadMessages({
					projectId: "p1",
					conversationId: "c1",
					workspaceId: "w1",
					search: "",
				}),
			{ wrapper: wrapper() },
		);

		await waitFor(() => expect(result.current.messages).toHaveLength(5));
		expect(result.current.hasOlder).toBe(false);
		// Never paged older.
		const calledBefore = vi
			.mocked(api)
			.mock.calls.some(([u]) => paramsOf(u as string).has("before"));
		expect(calledBefore).toBe(false);
	});
});
