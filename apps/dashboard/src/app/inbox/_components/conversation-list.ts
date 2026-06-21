import type { Conversation, Tag } from "./types";

/** A single list page from the API. */
export interface ConversationPage {
	conversations: Conversation[];
	nextCursor: string | null;
}

/** react-query's `useInfiniteQuery` cache shape. */
interface InfiniteCache {
	pages: ConversationPage[];
	pageParams: unknown[];
}

/**
 * Sort comparator matching the server keyset: (updatedAt DESC, id DESC). Applied
 * client-side after merging the polled head with the loaded pages, so a freshly
 * bumped conversation lands in the right slot regardless of which source it came
 * from.
 */
function byRecency(a: Conversation, b: Conversation): number {
	if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
	return a.id < b.id ? 1 : -1;
}

/**
 * Merge the polled head page with the infinite query's loaded pages into the
 * single ordered list the inbox renders. Deduped by id with the FIRST occurrence
 * winning — callers pass the head first, so its fresher copy (newer updatedAt,
 * cleared unread) supersedes a stale copy still sitting in a loaded page. This is
 * what lets the 5s head poll surface new/bumped conversations without the
 * infinite query refetching every page, and without duplicate rows.
 */
export function mergeConversationPages(
	lists: (Conversation[] | undefined)[],
): Conversation[] {
	const seen = new Set<string>();
	const merged: Conversation[] = [];
	for (const list of lists) {
		if (!list) continue;
		for (const c of list) {
			if (seen.has(c.id)) continue;
			seen.add(c.id);
			merged.push(c);
		}
	}
	return merged.sort(byRecency);
}

/** Flatten an infinite-query cache's pages into a single conversation list. */
export function flattenPages(data: InfiniteCache | undefined): Conversation[] {
	return data ? data.pages.flatMap((p) => p.conversations) : [];
}

/**
 * Apply `fn` to the conversation arrays inside whichever cache shape `prev` is —
 * the head query's `{ conversations }` or the infinite query's `{ pages: [...] }`.
 * Pure, immutable, undefined-safe (returns the input unchanged when it's neither
 * shape). One updater drives both caches so a single optimistic write spans them.
 */
function mapConversationsInCache(
	prev: unknown,
	fn: (list: Conversation[]) => Conversation[],
): unknown {
	if (!prev || typeof prev !== "object") return prev;
	if ("pages" in prev && Array.isArray((prev as InfiniteCache).pages)) {
		const cache = prev as InfiniteCache;
		return {
			...cache,
			pages: cache.pages.map((page) => ({
				...page,
				conversations: fn(page.conversations),
			})),
		};
	}
	if ("conversations" in prev) {
		const cache = prev as { conversations: Conversation[] };
		if (!Array.isArray(cache.conversations)) return prev;
		return { ...cache, conversations: fn(cache.conversations) };
	}
	return prev;
}

/** Optimistic updater: remove a conversation by id from head + infinite caches. */
export function dropConversationFromCache(prev: unknown, id: string): unknown {
	return mapConversationsInCache(prev, (list) =>
		list.filter((c) => c.id !== id),
	);
}

/** Optimistic updater: mark a conversation read (clear its unread dot) across
 * head + infinite caches, so a deep-in-a-page row clears without a refetch. */
export function setConversationRead(prev: unknown, id: string): unknown {
	return mapConversationsInCache(prev, (list) =>
		list.map((c) => (c.id === id ? { ...c, unread: false } : c)),
	);
}

/** Optimistic updater: attach a tag to a conversation across head + infinite
 * caches. Idempotent (skips if already present) and immutable. */
export function addTagToConversation(
	prev: unknown,
	id: string,
	tag: Tag,
): unknown {
	return mapConversationsInCache(prev, (list) =>
		list.map((c) => {
			if (c.id !== id) return c;
			const tags = c.tags ?? [];
			if (tags.some((t) => t.id === tag.id)) return c;
			return { ...c, tags: [...tags, tag] };
		}),
	);
}

/** Optimistic updater: detach a tag from a conversation across both caches. */
export function removeTagFromConversation(
	prev: unknown,
	id: string,
	tagId: string,
): unknown {
	return mapConversationsInCache(prev, (list) =>
		list.map((c) =>
			c.id === id
				? { ...c, tags: (c.tags ?? []).filter((t) => t.id !== tagId) }
				: c,
		),
	);
}
