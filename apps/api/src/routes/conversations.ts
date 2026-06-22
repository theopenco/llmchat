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
import { buildReplyToAddress, escapeHtml, sendEmail } from "@/lib/email";
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
} from "@llmchat/db";

import type { AppContext } from "@/env";

/** A tag as attached to a conversation in list responses. */
type ConversationTagView = { id: string; name: string; color: string | null };

/** Why a conversation surfaced in a search: an excerpt of the hit and which
 * field it came from, so the agent sees the reason in the list. */
type SearchMatch = { field: "body" | "name" | "email"; snippet: string };

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
				// Lazy-summary trigger. Set ("1") on genuine loads/scrolls, NEVER on
				// the 5s freshness poll — so summary generation scales with views, not
				// poll cadence. Absent ⇒ pure read.
				summarize: z.coerce.boolean().optional(),
			}),
		),
		async (c) => {
			const { projectId } = c.req.param();
			const { search, status, limit, cursor, tagIds } = c.req.valid("query");
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
					...r,
					firstMessage: firstByConv.get(r.id) ?? null,
					unread: (readByConv.get(r.id) ?? 0) < r.messageCount,
					match: matchFor(r),
					tags: tagsByConv.get(r.id) ?? [],
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
		const proj = await db(c.env).query.project.findFirst({
			where: (pt, { and: a, eq: e }) =>
				a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
		});
		if (!proj) {
			return c.json({ error: "not found" }, 404);
		}

		const [agg] = await db(c.env)
			.select({
				total: count(),
				escalated: sql<number>`sum(case when ${conversation.escalatedAt} is not null then 1 else 0 end)`,
				// "Resolved" == archived (the app's only closed state).
				resolved: sql<number>`sum(case when ${conversation.archivedAt} is not null then 1 else 0 end)`,
				// avg() ignores NULL csat, and is NULL when nothing is rated.
				avgRating: sql<number | null>`avg(${conversation.csatRating})`,
			})
			.from(conversation)
			.where(eq(conversation.projectId, projectId));

		return c.json({
			total: agg?.total ?? 0,
			escalated: Number(agg?.escalated ?? 0),
			resolved: Number(agg?.resolved ?? 0),
			avgRating: agg?.avgRating ?? null,
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

			return c.json({
				conversation: conv,
				messages,
				hasOlder,
				firstHitSequence,
			});
		},
	)
	.post(
		"/projects/:projectId/conversations/:id/reply",
		zValidator("json", z.object({ content: z.string().min(1) })),
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

			const nextSeq = conv.messageCount + 1;
			const messageId = `${crypto.randomUUID()}@${c.env.vars.INBOUND_EMAIL_DOMAIN}`;

			await db(c.env).insert(messageTable).values({
				conversationId: conv.id,
				role: "admin",
				content,
				sequence: nextSeq,
				authorUserId: userId,
				emailMessageId: messageId,
			});
			await db(c.env)
				.update(conversation)
				.set({ messageCount: nextSeq, updatedAt: new Date() })
				.where(eq(conversation.id, conv.id));

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

			if (archived !== undefined) {
				await db(c.env)
					.update(conversation)
					.set({ archivedAt: archived ? new Date() : null })
					.where(eq(conversation.id, id));
			}
			if (read) {
				const conv = await db(c.env).query.conversation.findFirst({
					where: (ct, { eq: e }) => e(ct.id, id),
				});
				if (conv) {
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
			await db(c.env).delete(conversation).where(eq(conversation.id, id));
			return c.json({ ok: true });
		},
	);
