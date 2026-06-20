"use client";

import {
	useMutation,
	useQueryClient,
	type QueryKey,
} from "@tanstack/react-query";

/**
 * One shared optimistic-mutation primitive so every write that should feel
 * instant uses the same cancel → snapshot → setQueryData → rollback → invalidate
 * shape instead of hand-rolling it per call (the pattern the projects pin/star
 * toggle pioneered).
 *
 * `queryKey` is a PARTIAL (prefix) key: the optimistic write — and its rollback —
 * apply to EVERY cached query that matches. That's deliberate, so removing a
 * conversation updates its row across every cached list variant (each search
 * term + the active/archived split are separate cache entries) in one shot, and
 * a failure restores all of them. On settle the prefix is invalidated to
 * reconcile the guess with the server's truth.
 *
 * `apply` must be PURE and immutable, and pass caches it doesn't change straight
 * through (return the input unchanged) — never-loaded variants arrive as
 * `undefined`. Returning a new reference signals "this cache changed"; returning
 * the same reference leaves that cache untouched.
 */
export interface OptimisticMutationOptions<TVars, TData> {
	queryKey: QueryKey;
	mutationFn: (vars: TVars) => Promise<TData>;
	apply: (prev: unknown, vars: TVars) => unknown;
	onSuccess?: (data: TData, vars: TVars) => void;
	onError?: (error: unknown, vars: TVars) => void;
}

interface RollbackContext {
	snapshot: [QueryKey, unknown][];
}

export function useOptimisticMutation<TVars, TData = unknown>({
	queryKey,
	mutationFn,
	apply,
	onSuccess,
	onError,
}: OptimisticMutationOptions<TVars, TData>) {
	const qc = useQueryClient();
	return useMutation<TData, unknown, TVars, RollbackContext>({
		mutationFn,
		onMutate: async (vars) => {
			// Stop in-flight refetches (e.g. the inbox's 3–5s polls) from landing on
			// top of — and erasing — the optimistic write before it's reconciled.
			await qc.cancelQueries({ queryKey });
			const snapshot = qc.getQueriesData({ queryKey });
			for (const [key, value] of snapshot) {
				const next = apply(value, vars);
				// Only touch caches the updater actually changed; this skips
				// never-loaded variants (undefined passes straight through).
				if (next !== value) qc.setQueryData(key, next);
			}
			return { snapshot };
		},
		onError: (error, vars, ctx) => {
			ctx?.snapshot.forEach(([key, value]) => qc.setQueryData(key, value));
			onError?.(error, vars);
		},
		onSuccess,
		onSettled: () => {
			void qc.invalidateQueries({ queryKey });
		},
	});
}

/**
 * Optimistic updater: drop the item with `id` from a `{ [field]: T[] }` cache.
 * Pure, immutable, and undefined-safe (returns the input unchanged when the
 * cache is empty or the field isn't an array).
 */
export function dropById(prev: unknown, field: string, id: string): unknown {
	if (!prev || typeof prev !== "object") return prev;
	const rec = prev as Record<string, unknown>;
	const list = rec[field];
	if (!Array.isArray(list)) return prev;
	return {
		...rec,
		[field]: list.filter((it) => (it as { id?: string }).id !== id),
	};
}

/**
 * Optimistic updater: replace the item with `id` in a `{ [field]: T[] }` cache
 * by running `fn` over it. Same purity / undefined-safety as `dropById`.
 */
export function mapById<T>(
	prev: unknown,
	field: string,
	id: string,
	fn: (item: T) => T,
): unknown {
	if (!prev || typeof prev !== "object") return prev;
	const rec = prev as Record<string, unknown>;
	const list = rec[field];
	if (!Array.isArray(list)) return prev;
	return {
		...rec,
		[field]: list.map((it) =>
			(it as { id?: string }).id === id ? fn(it as T) : it,
		),
	};
}
