import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/plan";
import {
	requireOwner,
	requireSession,
	requireWorkspace,
} from "@/middleware/session";

import {
	and,
	asc,
	conversation,
	count,
	eq,
	inArray,
	isNull,
	member,
	ne,
	project,
	readStatus,
	user,
	workspaceInvite,
	type Database,
} from "@llmchat/db";
import { isUnlimited } from "@llmchat/shared";

import type { AppContext } from "@/env";

const roleInput = z.object({ role: z.enum(["admin", "agent"]) });

/** Owners of `workspaceId` other than `excludeUserId` — the last-owner guard
 * (the resolveOwnership ne() count). Zero means the excluded user is the only
 * owner and must not be demoted or removed. */
async function otherOwnerCount(
	dbi: Database,
	workspaceId: string,
	excludeUserId: string,
) {
	const [row] = await dbi
		.select({ n: count() })
		.from(member)
		.where(
			and(
				eq(member.workspaceId, workspaceId),
				eq(member.role, "owner"),
				ne(member.userId, excludeUserId),
			),
		);
	return row?.n ?? 0;
}

// Middleware is attached PER ROUTE, never via `.use("*")`. A sub-app's
// wildcard middleware is registered at the mount prefix (`/api/*`), so it also
// runs for sibling sub-apps mounted at `/api` AFTER this one — which would put
// requireWorkspace in front of `/api/invites/accept`, whose whole point is that
// a brand-new invitee has no workspace yet. Route-scoped middleware makes the
// mount order in index.ts irrelevant (pinned by the accept test, which composes
// the app in production order).
export const members = new Hono<AppContext>()
	.get("/members", requireSession, requireWorkspace, async (c) => {
		const workspaceId = c.get("workspaceId");
		const rows = await db(c.env)
			.select({
				userId: member.userId,
				role: member.role,
				createdAt: member.createdAt,
				name: user.name,
				email: user.email,
			})
			.from(member)
			.innerJoin(user, eq(user.id, member.userId))
			.where(eq(member.workspaceId, workspaceId))
			.orderBy(asc(member.createdAt));
		const { entitlements } = await resolveAccess(c.env, workspaceId);
		return c.json({
			members: rows,
			seats: {
				used: rows.length,
				max: isUnlimited(entitlements.maxMembers)
					? null
					: entitlements.maxMembers,
			},
		});
	})
	.patch(
		"/members/:userId",
		requireSession,
		requireWorkspace,
		requireOwner,
		zValidator("json", roleInput),
		async (c) => {
			const workspaceId = c.get("workspaceId");
			const targetUserId = c.req.param("userId");
			const { role } = c.req.valid("json");
			const target = await db(c.env).query.member.findFirst({
				where: (m, { and: a, eq: e }) =>
					a(e(m.workspaceId, workspaceId), e(m.userId, targetUserId)),
			});
			if (!target) return c.json({ error: "not_member" }, 404);
			// Demoting an owner (self included) needs another owner to remain.
			if (
				target.role === "owner" &&
				(await otherOwnerCount(db(c.env), workspaceId, targetUserId)) === 0
			) {
				return c.json({ error: "last_owner" }, 409);
			}
			const [updated] = await db(c.env)
				.update(member)
				.set({ role })
				.where(
					and(
						eq(member.workspaceId, workspaceId),
						eq(member.userId, targetUserId),
					),
				)
				.returning({ userId: member.userId, role: member.role });
			return c.json({ member: updated });
		},
	)
	.delete("/members/:userId", requireSession, requireWorkspace, async (c) => {
		const workspaceId = c.get("workspaceId");
		const callerId = c.get("userId");
		const targetUserId = c.req.param("userId");
		const self = targetUserId === callerId;
		// Removing OTHERS is owner-only; leaving (self) is any role. The explicit
		// code keeps the dashboard's broken-workspace heuristic
		// (isWorkspaceAuthError) from re-provisioning on this 403.
		if (!self && c.get("role") !== "owner") {
			return c.json(
				{ error: "forbidden", code: "insufficient_role", required: "owner" },
				403,
			);
		}
		const target = await db(c.env).query.member.findFirst({
			where: (m, { and: a, eq: e }) =>
				a(e(m.workspaceId, workspaceId), e(m.userId, targetUserId)),
		});
		if (!target) return c.json({ error: "not_member" }, 404);
		if (
			target.role === "owner" &&
			(await otherOwnerCount(db(c.env), workspaceId, targetUserId)) === 0
		) {
			return c.json({ error: "last_owner" }, 409);
		}
		if (self) {
			// Mirror the workspace-delete guard: never strand a user workspace-less.
			const [{ n }] = await db(c.env)
				.select({ n: count() })
				.from(member)
				.where(eq(member.userId, callerId));
			if (n <= 1) return c.json({ error: "last_workspace" }, 409);
		}
		// Removal ≠ deletion (R3): the member row and their read watermarks in
		// THIS workspace go; the user row and authored-message attribution stay
		// (S6 — only account deletion scrubs authorUserId).
		const dbi = db(c.env);
		const projIds = dbi
			.select({ id: project.id })
			.from(project)
			.where(eq(project.workspaceId, workspaceId));
		const convIds = dbi
			.select({ id: conversation.id })
			.from(conversation)
			.where(inArray(conversation.projectId, projIds));
		await dbi.batch([
			// Revoke the pending invites this person minted. Otherwise a removed
			// admin keeps a live 7-day path back in: accept authorizes on
			// possession of the token, not on who still works here.
			dbi
				.update(workspaceInvite)
				.set({ revokedAt: new Date() })
				.where(
					and(
						eq(workspaceInvite.workspaceId, workspaceId),
						eq(workspaceInvite.createdBy, targetUserId),
						isNull(workspaceInvite.acceptedAt),
						isNull(workspaceInvite.revokedAt),
					),
				),
			dbi
				.delete(readStatus)
				.where(
					and(
						eq(readStatus.userId, targetUserId),
						inArray(readStatus.conversationId, convIds),
					),
				),
			dbi
				.delete(member)
				.where(
					and(
						eq(member.workspaceId, workspaceId),
						eq(member.userId, targetUserId),
					),
				),
		] as unknown as Parameters<Database["batch"]>[0]);
		return c.json({ ok: true });
	});
