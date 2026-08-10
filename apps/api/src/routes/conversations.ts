import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
	maybeSummarize,
	SUMMARY_PER_REQUEST_CAP,
	summaryIsStale,
} from "@/lib/conversation-summary";
import { decodeCursor, encodeCursor } from "@/lib/cursor";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/kv";
import { generateSuggestion, resolveServableModel } from "@/lib/llm";
import { insertMessage } from "@/lib/messages";
import { buildReplyToAddress, escapeHtml, sendEmail } from "@/lib/email";
import { resolveAccess } from "@/lib/plan";
import { captureEvent } from "@/lib/posthog";
import {
	MAX_MATCH_CONVERSATIONS,
	buildSnippet,
	includesCI,
	likeContains,
} from "@/lib/search";
import { TAG_NAME_MAX, findOrCreateTag } from "@/lib/tags";
import {
	requireRole,
	requireSession,
	requireWorkspace,
} from "@/middleware/session";

import {
	and,
	asc,
	conversation,
	conversationAssignment,
	conversationTag,
	count,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	message as messageTable,
	or,
	readStatus,
	sql,
	tag as tagTable,
	usageEvent,
	user as userTable,
	type Database,
} from "@llmchat/db";
import { ANALYTICS_EVENTS, isPaidPlan, RECAP_ROLES } from "@llmchat/shared";

import type { AppContext } from "@/env";

/** A tag as attached to a conversation in list responses. */
type ConversationTagView = { id: string; name: string; color: string | null };

/** The assignee as serialized on list rows and the thread conversation (#96).
 * Operator-surface only (R5): assembled by explicit joins, never a row spread.
 * `assignedBy` is the assigner's userId (audit; the dashboard resolves the
 * display name from its members cache). */
type AssigneeView = {
	userId: string;
	name: string | null;
	assignedBy: string | null;
};

/** Batched assignee lookup for a page of conversation ids. try/catch: an
 * un-migrated preview DB lacks the 0027 table — the INBOX must keep serving
 * (assignment degrades to "unassigned", nothing else breaks; the 0026
 * degrade-only-the-feature posture). */
async function assigneesFor(
	dbi: Database,
	ids: string[],
): Promise<Map<string, AssigneeView>> {
	const map = new Map<string, AssigneeView>();
	if (!ids.length) return map;
	try {
		const rows = await dbi
			.select({
				conversationId: conversationAssignment.conversationId,
				userId: conversationAssignment.assigneeUserId,
				assignedBy: conversationAssignment.assignedBy,
				name: userTable.name,
			})
			.from(conversationAssignment)
			.leftJoin(
				userTable,
				eq(userTable.id, conversationAssignment.assigneeUserId),
			)
			.where(inArray(conversationAssignment.conversationId, ids));
		for (const r of rows) {
			map.set(r.conversationId, {
				userId: r.userId,
				name: r.name ?? null,
				assignedBy: r.assignedBy,
			});
		}
	} catch (err) {
		// conversation_assignment missing (preview) — every row reads unassigned.
		// Anything else is a real failure that must not vanish into the degrade.
		if (!/no such table/i.test(String(err))) {
			console.error("assignment: page lookup failed", err);
		}
	}
	return map;
}

/** Why a conversation surfaced in a search: an excerpt of the hit and which
 * field it came from, so the agent sees the reason in the list. */
type SearchMatch = { field: "body" | "name" | "email"; snippet: string };

/** Cap on operator-authored message content (replies and internal notes) —
 * generous enough for pasted stack traces / order dumps, bounded against DB
 * abuse. The visitor-side cap is 8k (chat.ts MAX_MESSAGE_TEXT). */
const MESSAGE_CONTENT_MAX = 10_000;

// Suggest-with-AI (#98): the api's first AUTHENTICATED spend path — every other
// rateLimit caller guards public /v1. Both buckets fail CLOSED: a STATE outage
// degrades a convenience feature, it must never open unbounded spend on the
// shared gateway key (the agent-action guards' posture, the opposite of the
// public widget's fail-open).
const SUGGEST_RATE_MAX = 10;
const SUGGEST_RATE_WINDOW = 5 * 60;
const SUGGEST_DAILY_MAX = 200;
const SUGGEST_DAILY_WINDOW = 24 * 60 * 60;

/**
 * The visitor's clientId is a CREDENTIAL, not metadata: the public /v1/chat
 * identifies a conversation by (projectKey, clientId), so anyone holding the
 * pair can fabricate visitor turns in that conversation — and have the bot's
 * reply persisted and delivered to the real visitor (operator-side puppeting,
 * #170). It therefore never leaves the server on ANY authenticated surface;
 * every conversation row must pass through here before c.json. Everything
 * else on the row (name, email, counts, timestamps) is operator data.
 */
function withoutClientId<T extends { clientId: unknown }>(
	row: T,
): Omit<T, "clientId"> {
	const { clientId: _clientId, ...safe } = row;
	return safe;
}

export const conversations = new Hono<AppContext>()
	.use("*", requireSession, requireWorkspace)
	.get(
		"/projects/:projectId/conversations",
		zValidator(
			"query",
			z.object({
				search: z.string().optional(),
				// Derived status filter (query-only; no status column on the row):
				//   open      -> archivedAt IS NULL     (the default / active view)
				//   resolved  -> archivedAt IS NOT NULL (archiving IS resolving)
				//   escalated -> escalatedAt IS NOT NULL
				//   all       -> no status predicate
				// These are FILTER VIEWS, not mutually-exclusive states: an escalated
				// conversation can also be resolved. Don't "fix" the overlap into an
				// enum — there is no status column.
				status: z
					.enum(["open", "resolved", "escalated", "all"])
					.default("open"),
				limit: z.coerce.number().int().min(1).max(100).default(30),
				// Opaque keyset cursor (see lib/cursor). A garbage value decodes to
				// null below and just serves the first page — never a 400.
				cursor: z.string().optional(),
				// Comma-separated tag ids. OR semantics (a conversation matches if it
				// has ANY of them). Empty/absent ⇒ no tag filtering.
				tagIds: z.string().optional(),
				// Assignment view (#96): "me" ⇒ assigned to the caller, "none" ⇒
				// unassigned. A separate axis from `status` — they compose (an
				// escalated conversation can be mine). Absent ⇒ no assignee predicate.
				assignee: z.enum(["me", "none"]).optional(),
				// Lazy-summary trigger. Set ("1") on genuine loads/scrolls, NEVER on
				// the 5s freshness poll — so summary generation scales with views, not
				// poll cadence. Absent ⇒ pure read.
				summarize: z.coerce.boolean().optional(),
			}),
		),
		async (c) => {
			const { projectId } = c.req.param();
			const { search, status, limit, cursor, tagIds, assignee } =
				c.req.valid("query");
			const workspaceId = c.get("workspaceId");
			const userId = c.get("userId");

			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}

			const term = search?.trim() ?? "";

			// Derived status filter, server-side and explicit. Goes into the WHERE
			// before LIMIT/OFFSET and composes with the search OR-group + keyset
			// cursor below, so search/paging run within the chosen view. `all` adds
			// no predicate. See the `status` enum comment above for the mapping.
			const statusPredicate =
				status === "resolved"
					? isNotNull(conversation.archivedAt)
					: status === "escalated"
						? isNotNull(conversation.escalatedAt)
						: status === "open"
							? isNull(conversation.archivedAt)
							: undefined; // "all"
			const conditions = [
				eq(conversation.projectId, projectId),
				...(statusPredicate ? [statusPredicate] : []),
			];

			// Content search: a conversation matches on visitor name, email, OR any
			// message body. The message match is scoped to THIS project via a join
			// to conversation (never an unscoped scan of every workspace's
			// messages), bounded, and resolved into the conversation set BEFORE
			// pagination so search spans the whole project, not just the first page.
			if (term) {
				const bodyMatches = await db(c.env)
					.selectDistinct({ id: messageTable.conversationId })
					.from(messageTable)
					.innerJoin(
						conversation,
						eq(messageTable.conversationId, conversation.id),
					)
					.where(
						and(
							eq(conversation.projectId, projectId),
							likeContains(messageTable.content, term),
						),
					)
					.limit(MAX_MATCH_CONVERSATIONS);
				const bodyMatchIds = bodyMatches.map((m) => m.id);

				const orParts = [
					likeContains(conversation.name, term),
					likeContains(conversation.email, term),
				];
				if (bodyMatchIds.length) {
					orParts.push(inArray(conversation.id, bodyMatchIds));
				}
				conditions.push(or(...orParts)!);
			}

			// Keyset pagination on (updatedAt DESC, id DESC): resume strictly after
			// the cursor row. Raw SQL compares against the stored unix-seconds integer
			// directly, sidestepping the timestamp custom-type's driver mapping. ANDed
			// alongside the project scope, archived filter, and search OR-group — so it
			// composes with all of them. A garbage cursor decoded to null = page 1.
			const cur = decodeCursor(cursor);
			if (cur) {
				conditions.push(
					sql`(${conversation.updatedAt} < ${cur.updatedAt} OR (${conversation.updatedAt} = ${cur.updatedAt} AND ${conversation.id} < ${cur.id}))`,
				);
			}

			// Tag filter (OR semantics): keep conversations that carry ANY of the
			// given tags, via a scoped subquery on the join table. ANDed into the
			// same conditions as project scope / archived / search / cursor, so it
			// composes with keyset pagination and never widens beyond this project.
			// A foreign tag id simply matches nothing here — no leak.
			const tagIdList =
				tagIds
					?.split(",")
					.map((t) => t.trim())
					.filter(Boolean) ?? [];
			if (tagIdList.length) {
				// EXISTS-style subquery in raw SQL (like the keyset predicate above):
				// one round-trip, no giant IN list, and it stays a single ANDed
				// predicate so pagination + search + archived all still compose.
				const ids = sql.join(
					tagIdList.map((t) => sql`${t}`),
					sql`, `,
				);
				conditions.push(
					sql`${conversation.id} IN (SELECT ${conversationTag.conversationId} FROM ${conversationTag} WHERE ${conversationTag.tagId} IN (${ids}))`,
				);
			}

			// Assignee filter (#96): EXISTS-style subqueries like the tag filter
			// above — single ANDed predicates, so cursor/status/search/tags all
			// still compose. "me" matches on BOTH the conversation and the caller
			// (and-scoped, never a bare user match); "none" is the absence of any
			// assignment row. On an un-migrated preview DB these predicates error —
			// acceptable, they only fire when the assignment UI is used (the
			// default inbox sends no `assignee` param).
			if (assignee === "me") {
				conditions.push(
					sql`EXISTS (SELECT 1 FROM ${conversationAssignment} WHERE ${conversationAssignment.conversationId} = ${conversation.id} AND ${conversationAssignment.assigneeUserId} = ${userId})`,
				);
			} else if (assignee === "none") {
				conditions.push(
					sql`NOT EXISTS (SELECT 1 FROM ${conversationAssignment} WHERE ${conversationAssignment.conversationId} = ${conversation.id})`,
				);
			}

			// Fetch one extra row to know whether another page exists without a
			// second COUNT query.
			const page = await db(c.env)
				.select()
				.from(conversation)
				.where(and(...conditions))
				.orderBy(desc(conversation.updatedAt), desc(conversation.id))
				.limit(limit + 1);

			const hasMore = page.length > limit;
			const rows = hasMore ? page.slice(0, limit) : page;
			const last = rows.at(-1);
			const nextCursor =
				hasMore && last
					? encodeCursor({
							updatedAt: Math.floor(last.updatedAt.getTime() / 1000),
							id: last.id,
						})
					: null;

			// Attach the first visitor message (sequence 1) as a list preview —
			// one bounded query keyed on the page of conversations we're returning.
			const ids = rows.map((r) => r.id);

			// For the page being returned, pull the first message per conversation
			// whose body matched (scoped + bounded to these ids) so each row can show
			// *why* it matched. Ordered by sequence so the snippet is stable.
			const bodyMatchByConv = new Map<string, string>();
			if (term && ids.length) {
				const matchingBodies = await db(c.env)
					.select({
						conversationId: messageTable.conversationId,
						content: messageTable.content,
					})
					.from(messageTable)
					.innerJoin(
						conversation,
						eq(messageTable.conversationId, conversation.id),
					)
					.where(
						and(
							eq(conversation.projectId, projectId),
							inArray(messageTable.conversationId, ids),
							likeContains(messageTable.content, term),
						),
					)
					.orderBy(asc(messageTable.sequence));
				for (const m of matchingBodies) {
					if (!bodyMatchByConv.has(m.conversationId)) {
						bodyMatchByConv.set(m.conversationId, m.content);
					}
				}
			}

			// Classify each returned conversation's match: prefer the message body
			// excerpt (most informative), else flag the name/email hit so the agent
			// still sees why a no-message-match conversation surfaced.
			const matchFor = (r: (typeof rows)[number]): SearchMatch | null => {
				if (!term) return null;
				const body = bodyMatchByConv.get(r.id);
				if (body !== undefined) {
					return { field: "body", snippet: buildSnippet(body, term) };
				}
				if (r.name && includesCI(r.name, term)) {
					return { field: "name", snippet: r.name };
				}
				if (r.email && includesCI(r.email, term)) {
					return { field: "email", snippet: r.email };
				}
				return null;
			};
			const firstMessages = ids.length
				? await db(c.env)
						.select({
							conversationId: messageTable.conversationId,
							content: messageTable.content,
						})
						.from(messageTable)
						.where(
							and(
								inArray(messageTable.conversationId, ids),
								eq(messageTable.sequence, 1),
							),
						)
				: [];
			const firstByConv = new Map(
				firstMessages.map((m) => [m.conversationId, m.content]),
			);

			// Per-viewer read state: a conversation is unread when this user has
			// seen fewer messages than it currently has (or never opened it).
			const reads = ids.length
				? await db(c.env)
						.select({
							conversationId: readStatus.conversationId,
							lastReadMessageCount: readStatus.lastReadMessageCount,
						})
						.from(readStatus)
						.where(
							and(
								eq(readStatus.userId, userId),
								inArray(readStatus.conversationId, ids),
							),
						)
				: [];
			const readByConv = new Map(
				reads.map((r) => [r.conversationId, r.lastReadMessageCount]),
			);

			// Tags for the whole page in ONE query (no N+1): join the page's
			// conversation ids to their tags, grouped client-side into a map.
			const tagsByConv = new Map<string, ConversationTagView[]>();
			if (ids.length) {
				const tagRows = await db(c.env)
					.select({
						conversationId: conversationTag.conversationId,
						id: tagTable.id,
						name: tagTable.name,
						color: tagTable.color,
					})
					.from(conversationTag)
					.innerJoin(tagTable, eq(tagTable.id, conversationTag.tagId))
					.where(inArray(conversationTag.conversationId, ids))
					.orderBy(sql`lower(${tagTable.name})`);
				for (const t of tagRows) {
					const list = tagsByConv.get(t.conversationId) ?? [];
					list.push({ id: t.id, name: t.name, color: t.color });
					tagsByConv.set(t.conversationId, list);
				}
			}

			// Assignee per row (#96) — one batched query like tags/read-state above.
			const assigneeByConv = await assigneesFor(db(c.env), ids);

			// Lazy triage summaries: on a genuine load/scroll (summarize=1, never the
			// 5s poll), enqueue async generation for stale conversations on this page
			// — capped + cooldown-deduped, and OFF the customer's quota (writes no
			// usageEvent). The list returns immediately with whatever summaries are
			// cached; freshly-generated ones appear on the next load.
			if (c.req.valid("query").summarize) {
				const stale = rows
					.filter((r) => summaryIsStale(r))
					.slice(0, SUMMARY_PER_REQUEST_CAP);
				for (const r of stale) {
					c.executionCtx.waitUntil(
						maybeSummarize(c.env, { id: r.id, messageCount: r.messageCount }),
					);
				}
			}

			return c.json({
				conversations: rows.map((r) => ({
					...withoutClientId(r),
					firstMessage: firstByConv.get(r.id) ?? null,
					unread: (readByConv.get(r.id) ?? 0) < r.messageCount,
					match: matchFor(r),
					tags: tagsByConv.get(r.id) ?? [],
					assignee: assigneeByConv.get(r.id) ?? null,
				})),
				nextCursor,
			});
		},
	)
	.get("/projects/:projectId/conversations/stats", async (c) => {
		// True project-wide totals for the inbox header — independent of the
		// search term and the active/archived toggle, so the header is honest
		// even though the list itself paginates (loaded-page counts would read
		// as "so far"). One aggregate row, same ownership chain as the list.
		const { projectId } = c.req.param();
		const workspaceId = c.get("workspaceId");
		const userId = c.get("userId");
		const proj = await db(c.env).query.project.findFirst({
			where: (pt, { and: a, eq: e }) =>
				a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
		});
		if (!proj) {
			return c.json({ error: "not found" }, 404);
		}

		const baseAggregates = {
			total: count(),
			escalated: sql<number>`sum(case when ${conversation.escalatedAt} is not null then 1 else 0 end)`,
			// "Resolved" == archived (the app's only closed state).
			resolved: sql<number>`sum(case when ${conversation.archivedAt} is not null then 1 else 0 end)`,
			// avg() ignores NULL csat, and is NULL when nothing is rated.
			avgRating: sql<number | null>`avg(${conversation.csatRating})`,
		};
		// Assignment pill counts (#96): still ONE aggregate row, project-wide like
		// the rest of the header. "mine" derives the assignee from the SESSION
		// user and matches on BOTH the conversation and the caller (and-scoped —
		// a bare exists would count everyone's assignments as mine).
		const assignmentAggregates = {
			mine: sql<number>`sum(case when exists (select 1 from ${conversationAssignment} where ${conversationAssignment.conversationId} = ${conversation.id} and ${conversationAssignment.assigneeUserId} = ${userId}) then 1 else 0 end)`,
			unassigned: sql<number>`sum(case when not exists (select 1 from ${conversationAssignment} where ${conversationAssignment.conversationId} = ${conversation.id}) then 1 else 0 end)`,
		};

		let agg:
			| ({ total: number } & Record<
					"escalated" | "resolved" | "mine" | "unassigned",
					number
			  > & { avgRating: number | null })
			| undefined;
		try {
			[agg] = await db(c.env)
				.select({ ...baseAggregates, ...assignmentAggregates })
				.from(conversation)
				.where(eq(conversation.projectId, projectId));
		} catch (err) {
			// Un-migrated preview DB: no conversation_assignment table. Degrade
			// ONLY the two assignment counts to 0 — the header stays honest for
			// everything else. Anything else is a real failure worth a log line.
			if (!/no such table/i.test(String(err))) {
				console.error("assignment: stats aggregate failed", err);
			}
			const [plain] = await db(c.env)
				.select(baseAggregates)
				.from(conversation)
				.where(eq(conversation.projectId, projectId));
			agg = plain ? { ...plain, mine: 0, unassigned: 0 } : undefined;
		}

		return c.json({
			total: agg?.total ?? 0,
			escalated: Number(agg?.escalated ?? 0),
			resolved: Number(agg?.resolved ?? 0),
			avgRating: agg?.avgRating ?? null,
			mine: Number(agg?.mine ?? 0),
			unassigned: Number(agg?.unassigned ?? 0),
		});
	})
	.get(
		"/projects/:projectId/conversations/:id",
		zValidator(
			"query",
			z.object({
				limit: z.coerce.number().int().min(1).max(100).default(50),
				// Keyset on `sequence` (monotonic per conversation). `before` loads the
				// older page above; `after` is the newest-only poll; neither ⇒ the
				// latest page. `search` reports where the first hit is so the client can
				// page to it.
				before: z.coerce.number().int().optional(),
				after: z.coerce.number().int().optional(),
				search: z.string().optional(),
			}),
		),
		async (c) => {
			const { projectId, id } = c.req.param();
			const { limit, before, after, search } = c.req.valid("query");
			const workspaceId = c.get("workspaceId");
			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}
			const conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { and: a, eq: e }) =>
					a(e(ct.id, id), e(ct.projectId, projectId)),
			});
			if (!conv) {
				return c.json({ error: "not found" }, 404);
			}

			let messages;
			let hasOlder = false;
			if (after !== undefined) {
				// Poll: only messages newer than what the client holds. Bounded so a
				// long-idle tab can't pull an unbounded backlog in one go.
				messages = await db(c.env).query.message.findMany({
					where: (mt, { and: a, eq: e, gt }) =>
						a(e(mt.conversationId, id), gt(mt.sequence, after)),
					orderBy: (mt, { asc: ascOp }) => ascOp(mt.sequence),
					limit: 200,
				});
			} else {
				// Latest page (no cursor) or the older page above `before`. Fetch
				// limit+1 newest-first to detect more history without trusting sequence
				// to start at 1, then return `limit` rows ascending.
				const desc = await db(c.env).query.message.findMany({
					where: (mt, { and: a, eq: e, lt }) =>
						before === undefined
							? e(mt.conversationId, id)
							: a(e(mt.conversationId, id), lt(mt.sequence, before)),
					orderBy: (mt, { desc: descOp }) => descOp(mt.sequence),
					limit: limit + 1,
				});
				hasOlder = desc.length > limit;
				messages = desc.slice(0, limit).reverse();
			}

			// Tell the client the sequence of the FIRST (oldest) message matching the
			// search term, so it can page older until that message is loaded and then
			// scroll to it — a hit in an unloaded page would otherwise be invisible.
			let firstHitSequence: number | null = null;
			const term = search?.trim();
			if (term) {
				const [hit] = await db(c.env)
					.select({ sequence: messageTable.sequence })
					.from(messageTable)
					.where(
						and(
							eq(messageTable.conversationId, id),
							likeContains(messageTable.content, term),
						),
					)
					.orderBy(asc(messageTable.sequence))
					.limit(1);
				firstHitSequence = hit?.sequence ?? null;
			}

			// Durable audit trail of agent-taken actions on this conversation
			// (bookings, order lookups, returns) — operator visibility into what the
			// bot DID, so a mistaken/abusive action can be seen and reversed upstream.
			const actions = await db(c.env).query.agentAction.findMany({
				where: (a, { eq: e }) => e(a.conversationId, id),
				orderBy: (a, { asc: ascOp }) => ascOp(a.createdAt),
				limit: 200,
			});
			const agentActions = actions.map((a) => ({
				id: a.id,
				kind: a.kind,
				tool: a.tool,
				ok: a.ok,
				detail: a.detail,
				createdAt: a.createdAt,
			}));

			// Resolve author display names for operator-authored rows (admin replies,
			// internal notes) in one batched lookup. Null-safe by construction: rows
			// with no author (visitor/bot/system) and authors whose account was since
			// deleted (authorUserId scrubbed to null, or the user row gone) all map to
			// authorName: null and the UI falls back to a generic label.
			const authorIds = [
				...new Set(
					messages
						.map((m) => m.authorUserId)
						.filter((id): id is string => id !== null),
				),
			];
			const authors = authorIds.length
				? await db(c.env).query.user.findMany({
						where: (u, { inArray: inA }) => inA(u.id, authorIds),
						columns: { id: true, name: true },
					})
				: [];
			const authorNameById = new Map(authors.map((u) => [u.id, u.name]));
			const messagesWithAuthor = messages.map((m) => ({
				...m,
				authorName: m.authorUserId
					? (authorNameById.get(m.authorUserId) ?? null)
					: null,
			}));

			// Assignee (#96) — explicit lookup, same preview-degradation posture as
			// the list (the thread must keep serving without the 0027 table).
			const assigneeByConv = await assigneesFor(db(c.env), [conv.id]);

			return c.json({
				conversation: {
					...withoutClientId(conv),
					assignee: assigneeByConv.get(conv.id) ?? null,
				},
				messages: messagesWithAuthor,
				hasOlder,
				firstHitSequence,
				agentActions,
			});
		},
	)
	.post(
		"/projects/:projectId/conversations/:id/reply",
		zValidator(
			"json",
			z.object({ content: z.string().min(1).max(MESSAGE_CONTENT_MAX) }),
		),
		async (c) => {
			const { projectId, id } = c.req.param();
			const { content } = c.req.valid("json");
			const userId = c.get("userId");
			const workspaceId = c.get("workspaceId");

			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}
			const conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { and: a, eq: e }) =>
					a(e(ct.id, id), e(ct.projectId, projectId)),
			});
			if (!conv) {
				return c.json({ error: "not found" }, 404);
			}

			const messageId = `${crypto.randomUUID()}@${c.env.vars.INBOUND_EMAIL_DOMAIN}`;

			await insertMessage(c.env, {
				conversationId: conv.id,
				role: "admin",
				content,
				authorUserId: userId,
				emailMessageId: messageId,
			});

			// Claim-on-reply (#96 R4/A2): the first reply to an UNASSIGNED
			// conversation assigns the replier — AFTER the successful message insert
			// (a failed reply never claims) and BEFORE the email send (sendEmail
			// throws on a Resend failure, which must not skip the claim). ON
			// CONFLICT DO NOTHING is first-wins in one statement (D1 serializes
			// writers — the property insertMessage's sequence subquery relies on),
			// so it never reassigns and a concurrent double-reply yields exactly one
			// assignee. Notes/suggest structurally can't claim: this write exists
			// only in this handler. Deliberately no conversation-row touch (R6) —
			// insertMessage already bumped updatedAt for the reply itself.
			try {
				await db(c.env)
					.insert(conversationAssignment)
					.values({
						conversationId: conv.id,
						workspaceId,
						assigneeUserId: userId,
						assignedBy: userId,
						assignedAt: new Date(),
					})
					.onConflictDoNothing({
						target: conversationAssignment.conversationId,
					});
			} catch (err) {
				// conversation_assignment missing (preview) — the reply must still
				// deliver; it just goes unclaimed. Anything else is a real failure
				// that must not vanish into the degrade.
				if (!/no such table/i.test(String(err))) {
					console.error("assignment: claim-on-reply failed", err);
				}
			}

			if (conv.email) {
				await sendEmail(c.env, {
					to: conv.email,
					subject: `Re: your support conversation`,
					html: `<p>${escapeHtml(content)}</p>`,
					text: content,
					replyTo: buildReplyToAddress(c.env, proj.inboundEmailLocal),
					headers: { "Message-ID": `<${messageId}>` },
				});
			}

			return c.json({ ok: true });
		},
	)
	// Assignment (#96, docs/goals/assignment.md): workflow metadata ONLY — it is
	// never authorization (R3: no read path couples to it) and never serialized
	// to /v1 or any prompt surface (R5). All member roles may assign/unassign
	// anyone (R3) — deliberately no requireRole, matching /reply. One PUT carries
	// both operations (A1): a userId assigns/reassigns (upsert = last-write-wins,
	// no locking v1 — stated contract), an EXPLICIT null unassigns; an absent
	// field fails zod with a 400, so a partial payload can never silently
	// unassign. Deliberately no conversation-row touch: assigning bumps nothing
	// (R6 — no messageCount, no updatedAt re-sort). No preview try/catch here:
	// these routes ARE the feature (0026 degrade-only-the-feature posture).
	.put(
		"/projects/:projectId/conversations/:id/assignee",
		zValidator(
			"json",
			z.object({ assigneeUserId: z.string().min(1).nullable() }),
		),
		async (c) => {
			const { projectId, id } = c.req.param();
			const { assigneeUserId } = c.req.valid("json");
			const userId = c.get("userId");
			const workspaceId = c.get("workspaceId");

			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}
			// Tenant scope: and(), never bare eq() — a global conversation id alone
			// would let a member assign across tenants (same rule as DELETE below).
			const conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { and: a, eq: e }) =>
					a(e(ct.id, id), e(ct.projectId, projectId)),
			});
			if (!conv) {
				return c.json({ error: "not found" }, 404);
			}

			if (assigneeUserId === null) {
				// Unassign: idempotent — deleting an absent row is still { ok }.
				await db(c.env)
					.delete(conversationAssignment)
					.where(eq(conversationAssignment.conversationId, conv.id));
				return c.json({ ok: true });
			}

			// The assignee must hold a member row in THIS workspace (R2:
			// and()-scoped — a bare userId match would accept any known user id).
			const assigneeMember = await db(c.env).query.member.findFirst({
				where: (m, { and: a, eq: e }) =>
					a(e(m.workspaceId, workspaceId), e(m.userId, assigneeUserId)),
			});
			if (!assigneeMember) {
				return c.json(
					{
						error: "assignee is not a member of this workspace",
						code: "not_a_member",
					},
					400,
				);
			}

			await db(c.env)
				.insert(conversationAssignment)
				.values({
					conversationId: conv.id,
					workspaceId,
					assigneeUserId,
					assignedBy: userId,
					assignedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: conversationAssignment.conversationId,
					set: {
						assigneeUserId,
						assignedBy: userId,
						assignedAt: new Date(),
					},
				});
			return c.json({ ok: true });
		},
	)
	// Internal note: operator-only content on the conversation thread. Deliberately
	// a SEPARATE endpoint from /reply — the exclusion from email is structural
	// (this handler contains no sendEmail/Slack/analytics code and stamps no
	// emailMessageId, so a note can never transit any outbound channel), and the
	// role allowlists (VISITOR_VISIBLE_ROLES, RECAP_ROLES, QUOTABLE_ROLES) keep
	// role="note" rows out of every visitor/model surface. All member roles can
	// write notes — triage annotation is the agent role's job.
	.post(
		"/projects/:projectId/conversations/:id/notes",
		// Intentionally redundant with requireWorkspace today (agent = lowest
		// rank) — defense in depth if workspace admission ever widens.
		requireRole("agent"),
		zValidator(
			"json",
			z.object({ content: z.string().min(1).max(MESSAGE_CONTENT_MAX) }),
		),
		async (c) => {
			const { projectId, id } = c.req.param();
			const { content } = c.req.valid("json");
			const userId = c.get("userId");
			const workspaceId = c.get("workspaceId");

			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}
			const conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { and: a, eq: e }) =>
					a(e(ct.id, id), e(ct.projectId, projectId)),
			});
			if (!conv) {
				return c.json({ error: "not found" }, 404);
			}

			// Allocation is atomic in insertMessage (#146 resolved — no more
			// pre-fetched-count collisions with chat/escalate). The count bump
			// also flips teammates' unread on and re-sorts the inbox — intended:
			// a note IS new team-visible content. NO emailMessageId: notes never
			// seed email threading (a visitor reply could otherwise thread off a
			// note's Message-ID).
			const { row: created } = await insertMessage(c.env, {
				conversationId: conv.id,
				role: "note",
				content,
				authorUserId: userId,
			});

			return c.json(
				{
					message: {
						id: created.id,
						role: created.role,
						content: created.content,
						sequence: created.sequence,
						authorUserId: created.authorUserId,
						createdAt: created.createdAt,
					},
				},
				201,
			);
		},
	)
	// Suggest-with-AI (#98): draft the team's next reply from the project's
	// knowledge base + the RECAP_ROLES-filtered history. Returns TEXT ONLY —
	// structurally this handler contains no insertMessage/sendEmail/Slack code
	// (the /notes philosophy), so nothing visitor-visible can fire: no message
	// row, no email, no conversation mutation, no summary regeneration. Metering
	// is recorded as kind='suggestion', which every visitor-response counter
	// (lib/plan.ts, /projects/usage) excludes by design, and NO Stripe meter
	// event is reported — a draft must never bill an overage customer.
	.post(
		"/projects/:projectId/conversations/:id/suggest",
		requireRole("agent"),
		async (c) => {
			const { projectId, id } = c.req.param();
			const userId = c.get("userId");
			const workspaceId = c.get("workspaceId");

			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}
			const conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { and: a, eq: e }) =>
					a(e(ct.id, id), e(ct.projectId, projectId)),
			});
			if (!conv) {
				return c.json({ error: "not found" }, 404);
			}

			// Drafts spend real inference on the shared key: unpaid workspaces are
			// gated exactly like the live agent (402) — but a fixed tier OVER its
			// visitor quota may still draft (suggestions are excluded from that
			// quota, and the rate limits below bound spend). Locked decisions,
			// docs/goals/98-suggest-with-ai-phase1.md §8 Q1/Q2.
			const { exempt, plan } = await resolveAccess(c.env, workspaceId);
			if (!exempt && !isPaidPlan(plan)) {
				return c.json({ error: "subscription_required" }, 402);
			}

			const perOperator = await rateLimit(
				c.env,
				`suggest:${proj.id}:${userId}`,
				SUGGEST_RATE_MAX,
				SUGGEST_RATE_WINDOW,
				{ failClosed: true },
			);
			if (!perOperator.ok) {
				return c.json({ error: "rate limit exceeded" }, 429);
			}
			const perWorkspaceDaily = await rateLimit(
				c.env,
				`suggest-day:${workspaceId}`,
				SUGGEST_DAILY_MAX,
				SUGGEST_DAILY_WINDOW,
				{ failClosed: true },
			);
			if (!perWorkspaceDaily.ok) {
				return c.json({ error: "rate limit exceeded" }, 429);
			}

			// R1 — the allowlist lives in the SQL WHERE: internal notes (and any
			// future role) never reach worker memory for this request, let alone
			// the model. System markers are events, not conversation content.
			const rows = await db(c.env).query.message.findMany({
				where: (m, { and: a, eq: e, inArray: inA }) =>
					a(e(m.conversationId, conv.id), inA(m.role, [...RECAP_ROLES])),
				orderBy: (m, { asc: ascOp }) => ascOp(m.sequence),
				columns: { role: true, content: true },
			});
			if (!rows.some((m) => m.role === "user" && m.content.trim())) {
				return c.json(
					{ error: "nothing to draft from", code: "empty_conversation" },
					422,
				);
			}

			// Same prompt inputs as the live agent: active system-prompt variant,
			// active sources, stored identity — so the draft says what the bot
			// would say, reviewed by a human instead of streamed to the visitor.
			let activePromptContent = proj.systemPrompt;
			if (proj.activeSystemPromptId) {
				const active = await db(c.env).query.systemPrompt.findFirst({
					where: (sp, { and: a, eq: e }) =>
						a(e(sp.id, proj.activeSystemPromptId!), e(sp.projectId, proj.id)),
				});
				if (active) activePromptContent = active.content;
			}
			const activeSources = await db(c.env).query.source.findMany({
				where: (s, { and: a, eq: e }) =>
					a(e(s.projectId, proj.id), e(s.active, true)),
			});

			const model = resolveServableModel(proj, plan, exempt);
			let result: Awaited<ReturnType<typeof generateSuggestion>>;
			try {
				result = await generateSuggestion(c.env, {
					model,
					systemPrompt: activePromptContent,
					knowledgeText: proj.knowledgeText,
					sources: activeSources.map((s) => ({
						title: s.title || s.url || "",
						url: s.url ?? "",
						content: s.content,
					})),
					identity: { name: conv.name, email: conv.email },
					messages: rows,
				});
			} catch (err) {
				console.error("suggest: model call failed", err);
				return c.json({ error: "assistant unavailable" }, 502);
			}
			if (!result) {
				// Empty transcript survived the check above (whitespace-only) or the
				// model returned nothing — honesty rail: never a fabricated draft.
				return c.json({ error: "assistant unavailable" }, 502);
			}
			const { draft, usage } = result;

			// Record-but-never-count (R4): one kind='suggestion' usage row +
			// a CONTENT-FREE analytics event. Detached from the response like
			// chat's metering; the fallback float mirrors captureInBackground
			// (tests invoke routes without an ExecutionContext).
			const record = (async () => {
				try {
					await db(c.env)
						.insert(usageEvent)
						.values({
							workspaceId,
							projectId: proj.id,
							conversationId: conv.id,
							messageId: "",
							model,
							kind: "suggestion",
							promptTokens: usage.inputTokens ?? 0,
							completionTokens: usage.outputTokens ?? 0,
							costUsd: 0,
						});
					await captureEvent(c.env, {
						event: ANALYTICS_EVENTS.aiSuggestionGenerated,
						distinctId: userId,
						properties: {
							project_id: proj.id,
							workspace_id: workspaceId,
							model,
						},
					});
				} catch (err) {
					console.error("suggest: usage record failed", err);
				}
			})();
			try {
				c.executionCtx.waitUntil(record);
			} catch {
				void record;
			}

			return c.json({ draft, model });
		},
	)
	.patch(
		"/projects/:projectId/conversations/:id",
		zValidator(
			"json",
			z.object({
				archived: z.boolean().optional(),
				read: z.boolean().optional(),
			}),
		),
		async (c) => {
			const { projectId, id } = c.req.param();
			const { archived, read } = c.req.valid("json");
			const userId = c.get("userId");
			const workspaceId = c.get("workspaceId");

			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}

			// Tenant scope: the conversation must belong to THIS project — else 404.
			// Without this, any workspace member could archive (or mark read) another
			// tenant's conversation by its global id. Banked rule: and(), never bare eq().
			const conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { and: a, eq: e }) =>
					a(e(ct.id, id), e(ct.projectId, projectId)),
			});
			if (!conv) {
				return c.json({ error: "not found" }, 404);
			}

			if (archived !== undefined) {
				await db(c.env)
					.update(conversation)
					.set({
						archivedAt: archived ? new Date() : null,
						// Attribution mirror of archivedAt: an operator resolving from the
						// dashboard is recorded as "admin"; reopening clears both.
						resolvedBy: archived ? "admin" : null,
					})
					.where(
						and(eq(conversation.id, id), eq(conversation.projectId, projectId)),
					);
			}
			if (read) {
				const existing = await db(c.env).query.readStatus.findFirst({
					where: (rt, { and: a, eq: e }) =>
						a(e(rt.conversationId, id), e(rt.userId, userId)),
				});
				if (existing) {
					await db(c.env)
						.update(readStatus)
						.set({
							lastReadMessageCount: conv.messageCount,
							readAt: new Date(),
						})
						.where(eq(readStatus.id, existing.id));
				} else {
					await db(c.env).insert(readStatus).values({
						conversationId: id,
						userId,
						lastReadMessageCount: conv.messageCount,
					});
				}
			}

			return c.json({ ok: true });
		},
	)
	// Attach a tag to a conversation. `tagId` attaches an existing workspace tag;
	// `name` creates-and-attaches (dedupe case-insensitively). Any workspace
	// member. Idempotent: re-attaching the same tag is a no-op.
	.post(
		"/projects/:projectId/conversations/:id/tags",
		zValidator(
			"json",
			z
				.object({
					tagId: z.string().optional(),
					name: z.string().trim().min(1).max(TAG_NAME_MAX).optional(),
					color: z.string().max(32).optional(),
				})
				.refine((d) => d.tagId || d.name, {
					message: "tagId or name required",
				}),
		),
		async (c) => {
			const { projectId, id } = c.req.param();
			const { tagId, name, color } = c.req.valid("json");
			const workspaceId = c.get("workspaceId");

			// Tenant chain: project ∈ workspace, conversation ∈ project.
			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) return c.json({ error: "not found" }, 404);
			const conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { and: a, eq: e }) =>
					a(e(ct.id, id), e(ct.projectId, projectId)),
			});
			if (!conv) return c.json({ error: "not found" }, 404);

			// Resolve the tag. By id: it MUST belong to this workspace (else 404 — no
			// cross-workspace attach, no existence leak). By name: find-or-create.
			let resolved: ConversationTagView;
			if (tagId) {
				const t = await db(c.env).query.tag.findFirst({
					where: (tt, { and: a, eq: e }) =>
						a(e(tt.id, tagId), e(tt.workspaceId, workspaceId)),
				});
				if (!t) return c.json({ error: "not found" }, 404);
				resolved = { id: t.id, name: t.name, color: t.color };
			} else {
				const { tag: t } = await findOrCreateTag(
					c.env,
					workspaceId,
					name!,
					color,
				);
				resolved = { id: t.id, name: t.name, color: t.color };
			}

			// Idempotent attach: skip if the association already exists.
			const already = await db(c.env).query.conversationTag.findFirst({
				where: (xt, { and: a, eq: e }) =>
					a(e(xt.conversationId, id), e(xt.tagId, resolved.id)),
			});
			if (!already) {
				await db(c.env)
					.insert(conversationTag)
					.values({ conversationId: id, tagId: resolved.id });
			}
			return c.json({ tag: resolved });
		},
	)
	// Detach a tag. No-op-safe when the association doesn't exist. Any member.
	.delete("/projects/:projectId/conversations/:id/tags/:tagId", async (c) => {
		const { projectId, id, tagId } = c.req.param();
		const workspaceId = c.get("workspaceId");
		const proj = await db(c.env).query.project.findFirst({
			where: (pt, { and: a, eq: e }) =>
				a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
		});
		if (!proj) return c.json({ error: "not found" }, 404);
		const conv = await db(c.env).query.conversation.findFirst({
			where: (ct, { and: a, eq: e }) =>
				a(e(ct.id, id), e(ct.projectId, projectId)),
		});
		if (!conv) return c.json({ error: "not found" }, 404);

		await db(c.env)
			.delete(conversationTag)
			.where(
				and(
					eq(conversationTag.conversationId, id),
					eq(conversationTag.tagId, tagId),
				),
			);
		return c.json({ ok: true });
	})
	.delete(
		"/projects/:projectId/conversations/:id",
		requireRole("admin"),
		async (c) => {
			const { projectId, id } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}
			// Tenant scope: the conversation must belong to THIS project — else 404.
			// Banked rule: and(), never bare eq() (a global conversation id alone
			// would let an admin delete another tenant's conversation).
			const conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { and: a, eq: e }) =>
					a(e(ct.id, id), e(ct.projectId, projectId)),
			});
			if (!conv) {
				return c.json({ error: "not found" }, 404);
			}
			// #96: the assignment row goes explicitly, before the conversation row
			// (house law — never rely on the FK cascade). try/catch: un-migrated
			// preview DBs lack the table; the delete itself must still work.
			try {
				await db(c.env)
					.delete(conversationAssignment)
					.where(eq(conversationAssignment.conversationId, id));
			} catch (err) {
				// conversation_assignment missing (preview) — nothing to clean.
				if (!/no such table/i.test(String(err))) {
					console.error("assignment: delete cleanup failed", err);
				}
			}
			await db(c.env)
				.delete(conversation)
				.where(
					and(eq(conversation.id, id), eq(conversation.projectId, projectId)),
				);
			return c.json({ ok: true });
		},
	);
