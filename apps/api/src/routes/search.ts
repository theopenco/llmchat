import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import {
	MAX_MATCH_CONVERSATIONS,
	buildSnippet,
	includesCI,
	likeContains,
} from "@/lib/search";
import { workspaceProjectIds } from "@/lib/workspace-scope";
import { requireSession, requireWorkspace } from "@/middleware/session";

import {
	and,
	asc,
	conversation,
	desc,
	eq,
	inArray,
	message as messageTable,
	or,
	project,
} from "@llmchat/db";

import type { AppContext } from "@/env";

// Per-entity hard caps. The palette shows a handful per group, and a small,
// bounded result set keeps each (debounced) per-keystroke query cheap even when
// the search fans across every project in the workspace. The unindexable
// `LIKE '%term%'` scan (see lib/search.ts) is the cost driver, so bounding is
// not optional.
const CONVERSATION_LIMIT = 8;
const PROJECT_LIMIT = 5;
// Below this, the palette shows its own prompt and we don't query — a 1-char
// term would scan almost everything for no useful result.
const MIN_QUERY_LENGTH = 2;

/** Why a result surfaced: an excerpt of the hit + which field it came from, so
 * the palette can show the reason (and highlight the term). */
type SearchMatch = { field: "body" | "name" | "email"; snippet: string };

type ConversationResult = {
	id: string;
	projectId: string;
	projectName: string;
	name: string | null;
	email: string | null;
	match: SearchMatch;
};

type ProjectResult = { id: string; name: string };

const EMPTY = { conversations: [], projects: [] } as {
	conversations: ConversationResult[];
	projects: ProjectResult[];
};

/**
 * Workspace-wide global search for the ⌘K palette. Searches conversations (by
 * visitor name, email, or message body) and projects (by name) across ALL
 * projects in the caller's workspace — the cross-project counterpart to the
 * single-project inbox search in conversations.ts.
 *
 * Tenant isolation is the crux (this repo has an IDOR history): conversation
 * and message have no `workspaceId`, so EVERY result is constrained to the
 * workspace's project-id set (via {@link workspaceProjectIds}) inside the base
 * WHERE — so the constraint composes with the per-entity cap rather than being
 * bolted on after a LIMIT. A workspace with no projects short-circuits to empty
 * (never an unconstrained `IN ()` scan). Mounted behind requireSession +
 * requireWorkspace; reads are open to any member (agent+), matching the inbox.
 *
 * Never returns project secrets/config (publicKey, inboundEmailLocal,
 * systemPrompt, knowledgeText) — only id + name.
 */
export const search = new Hono<AppContext>()
	.use("*", requireSession, requireWorkspace)
	.get(
		"/search",
		zValidator("query", z.object({ q: z.string().optional() })),
		async (c) => {
			const workspaceId = c.get("workspaceId");
			const term = c.req.valid("query").q?.trim() ?? "";

			// Honesty + cost rail: a too-short (or empty) term returns nothing rather
			// than a near-everything scan. The palette shows its own idle prompt.
			if (term.length < MIN_QUERY_LENGTH) {
				return c.json(EMPTY);
			}

			// The tenant boundary, expressed once: the projects in the caller's
			// (membership-validated) workspace. Every entity below is intersected
			// against this set.
			const projectIds = await workspaceProjectIds(c.env, workspaceId);
			// Empty-set guard: no projects ⇒ empty results. Critically, this must
			// short-circuit BEFORE any `inArray(..., projectIds)` — Drizzle would emit
			// `IN ()` for an empty array, which is invalid SQL, and skipping the
			// predicate entirely would scan every tenant's rows. Empty, never all.
			if (projectIds.length === 0) {
				return c.json(EMPTY);
			}

			// ── Projects: name only, scoped directly by workspace. id + name only —
			// never publicKey/inboundEmailLocal/systemPrompt/knowledgeText. ──
			const projectRows = await db(c.env)
				.select({ id: project.id, name: project.name })
				.from(project)
				.where(
					and(
						eq(project.workspaceId, workspaceId),
						likeContains(project.name, term),
					),
				)
				.orderBy(asc(project.name))
				.limit(PROJECT_LIMIT);

			// ── Conversations: visitor name / email / message body. The body arm is
			// the two-hop path (message → conversation → project); it's scoped to the
			// workspace project set and bounded by MAX_MATCH_CONVERSATIONS so a broad
			// term can't drag back an unbounded id set. ──
			const bodyMatches = await db(c.env)
				.selectDistinct({ id: messageTable.conversationId })
				.from(messageTable)
				.innerJoin(
					conversation,
					eq(messageTable.conversationId, conversation.id),
				)
				.where(
					and(
						inArray(conversation.projectId, projectIds),
						likeContains(messageTable.content, term),
					),
				)
				.limit(MAX_MATCH_CONVERSATIONS);
			const bodyMatchIds = bodyMatches.map((m) => m.id);

			// name OR email OR (body-matched id). The workspace scope is a separate
			// ANDed predicate in the base WHERE below, so it constrains the OR group
			// and composes with the ORDER BY + LIMIT.
			const orParts = [
				likeContains(conversation.name, term),
				likeContains(conversation.email, term),
			];
			if (bodyMatchIds.length) {
				orParts.push(inArray(conversation.id, bodyMatchIds));
			}

			// Single-table select (no join): the tenant boundary is the
			// `inArray(projectId, projectIds)` predicate. The project NAME is resolved
			// in a separate bounded lookup below — selecting project.name alongside
			// conversation.name here would produce two result columns both named
			// "name", and the driver collapses the duplicate.
			const convRows = await db(c.env)
				.select({
					id: conversation.id,
					projectId: conversation.projectId,
					name: conversation.name,
					email: conversation.email,
				})
				.from(conversation)
				.where(
					and(inArray(conversation.projectId, projectIds), or(...orParts)!),
				)
				.orderBy(desc(conversation.updatedAt), desc(conversation.id))
				.limit(CONVERSATION_LIMIT);

			// Project names for the returned rows only — at most CONVERSATION_LIMIT
			// distinct ids, all already proven in-workspace (drawn from projectIds).
			// The eq(workspaceId) is redundant given that derivation, but kept so this
			// query self-asserts the tenant boundary too ("and(), never bare eq()") —
			// no result depends on an upstream invariant alone.
			const neededProjectIds = [...new Set(convRows.map((r) => r.projectId))];
			const projectNameById = new Map<string, string>();
			if (neededProjectIds.length) {
				const nameRows = await db(c.env)
					.select({ id: project.id, name: project.name })
					.from(project)
					.where(
						and(
							inArray(project.id, neededProjectIds),
							eq(project.workspaceId, workspaceId),
						),
					);
				for (const p of nameRows) projectNameById.set(p.id, p.name);
			}

			// For the returned page, pull the first body that matched per conversation
			// (scoped + bounded to these ids) so each row can show WHY it surfaced.
			const ids = convRows.map((r) => r.id);
			const bodyByConv = new Map<string, string>();
			if (ids.length) {
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
							inArray(conversation.projectId, projectIds),
							inArray(messageTable.conversationId, ids),
							likeContains(messageTable.content, term),
						),
					)
					.orderBy(asc(messageTable.sequence));
				for (const m of matchingBodies) {
					if (!bodyByConv.has(m.conversationId)) {
						bodyByConv.set(m.conversationId, m.content);
					}
				}
			}

			// Classify each match: prefer the body excerpt (most informative), else
			// the name/email hit so a no-body-match row still shows its reason.
			const conversations: ConversationResult[] = convRows.map((r) => {
				const body = bodyByConv.get(r.id);
				let match: SearchMatch;
				if (body !== undefined) {
					match = { field: "body", snippet: buildSnippet(body, term) };
				} else if (r.name && includesCI(r.name, term)) {
					match = { field: "name", snippet: r.name };
				} else if (r.email && includesCI(r.email, term)) {
					match = { field: "email", snippet: r.email };
				} else {
					// Unreachable in practice (a row is here only because something
					// matched), but stay honest rather than assert a field.
					match = { field: "name", snippet: r.name ?? r.email ?? "" };
				}
				return {
					id: r.id,
					projectId: r.projectId,
					projectName: projectNameById.get(r.projectId) ?? "",
					name: r.name,
					email: r.email,
					match,
				};
			});

			return c.json({ conversations, projects: projectRows });
		},
	);
