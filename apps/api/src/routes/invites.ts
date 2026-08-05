import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
	INVITE_TTL_SECONDS,
	buildInviteEmail,
	generateInviteToken,
	sha256Hex,
} from "@/lib/invites";
import { rateLimit } from "@/lib/kv";
import { isUniqueViolation } from "@/lib/db-errors";
import { memberCount, resolveAccess } from "@/lib/plan";
import { captureInBackground } from "@/lib/posthog";
import { clientIp } from "@/lib/request";
import {
	requireRole,
	requireSession,
	requireWorkspace,
} from "@/middleware/session";

import {
	and,
	desc,
	eq,
	gt,
	isNull,
	sql,
	user,
	workspaceInvite,
} from "@llmchat/db";
import { ANALYTICS_EVENTS, isWithinLimit } from "@llmchat/shared";

import type { AppContext } from "@/env";

type Env = AppContext["Bindings"];

const createInput = z.object({
	email: z.email().max(320),
	role: z.enum(["admin", "agent"]),
});

// 43 chars of base64url today; bounds are generous so a future token-size
// change doesn't 400 old links mid-window.
const tokenInput = z.object({ token: z.string().min(20).max(200) });

// Invite creation mints a bearer credential — both buckets fail CLOSED (the
// shopify-register posture for credential-write paths).
const CREATE_PER_OPERATOR_MAX = 10; // per operator per workspace per hour
const CREATE_PER_WORKSPACE_MAX = 50; // per workspace per day
// Accept/preview probes per IP per hour (fail CLOSED): bounds token probing
// and the DB lookups behind it; the 256-bit token is the real guessing bound.
// SEPARATE buckets: a shared office NAT (or a self-host where clientIp falls
// back to "unknown" for everyone) must not have its cheap preview reads eat
// the budget that actual accepts need.
const PREVIEW_PER_IP_MAX = 60;
const ACCEPT_PER_IP_MAX = 20;

type InviteRow = NonNullable<
	Awaited<
		ReturnType<ReturnType<typeof db>["query"]["workspaceInvite"]["findFirst"]>
	>
>;

async function findByToken(env: Env, token: string) {
	const tokenHash = await sha256Hex(token);
	return db(env).query.workspaceInvite.findFirst({
		where: (i, { eq: e }) => e(i.tokenHash, tokenHash),
	});
}

/** UX classification only — the atomic burn UPDATE is the authority. */
function classifyGone(
	invite: Pick<InviteRow, "acceptedAt" | "revokedAt" | "expiresAt">,
): "invite_used" | "invite_revoked" | "invite_expired" | null {
	if (invite.acceptedAt) return "invite_used";
	if (invite.revokedAt) return "invite_revoked";
	if (invite.expiresAt.getTime() <= Date.now()) return "invite_expired";
	return null;
}

/** Compensating write for a burn whose seat insert didn't land, guarded by
 * acceptedBy so it only ever un-burns our own burn. Best-effort: if this
 * fails, the invite stays consumed and a re-invite recovers. */
async function unburn(env: Env, inviteId: string, userId: string) {
	try {
		await db(env)
			.update(workspaceInvite)
			.set({ acceptedAt: null, acceptedBy: null })
			.where(
				and(
					eq(workspaceInvite.id, inviteId),
					eq(workspaceInvite.acceptedBy, userId),
					// If an operator revoked during the burn window their revoke
					// found no pending row and silently no-op'd; un-burning here
					// would resurrect an invite they meant to kill. Leaving it
					// consumed is the fail-closed direction.
					isNull(workspaceInvite.revokedAt),
				),
			);
	} catch (err) {
		console.error(
			"invite: un-burn failed — invite stays consumed; re-invite recovers",
			err,
		);
	}
}

export const invites = new Hono<AppContext>()
	.get(
		"/invites",
		requireSession,
		requireWorkspace,
		requireRole("admin"),
		async (c) => {
			const workspaceId = c.get("workspaceId");
			// Projection deliberately excludes token_hash — no token material ever
			// leaves this router outside the create response's one-time link.
			const rows = await db(c.env)
				.select({
					id: workspaceInvite.id,
					email: workspaceInvite.email,
					role: workspaceInvite.role,
					createdAt: workspaceInvite.createdAt,
					expiresAt: workspaceInvite.expiresAt,
					inviterName: user.name,
				})
				.from(workspaceInvite)
				.leftJoin(user, eq(user.id, workspaceInvite.createdBy))
				.where(
					and(
						eq(workspaceInvite.workspaceId, workspaceId),
						isNull(workspaceInvite.acceptedAt),
						isNull(workspaceInvite.revokedAt),
						gt(workspaceInvite.expiresAt, new Date()),
					),
				)
				.orderBy(desc(workspaceInvite.createdAt));
			return c.json({ invites: rows });
		},
	)
	.post(
		"/invites",
		requireSession,
		requireWorkspace,
		requireRole("admin"),
		zValidator("json", createInput),
		async (c) => {
			const workspaceId = c.get("workspaceId");
			const userId = c.get("userId");
			const body = c.req.valid("json");

			// R3: admins invite agents; only owners mint admin invites.
			if (body.role === "admin" && c.get("role") !== "owner") {
				return c.json(
					{ error: "forbidden", code: "insufficient_role", required: "owner" },
					403,
				);
			}

			const [perOperator, perWorkspace] = await Promise.all([
				rateLimit(
					c.env,
					`invite:${workspaceId}:${userId}`,
					CREATE_PER_OPERATOR_MAX,
					3600,
					{ failClosed: true },
				),
				rateLimit(
					c.env,
					`invite-day:${workspaceId}`,
					CREATE_PER_WORKSPACE_MAX,
					86400,
					{ failClosed: true },
				),
			]);
			if (!perOperator.ok || !perWorkspace.ok) {
				return c.json({ error: "rate limit exceeded" }, 429);
			}

			// Advisory seat check — a friendly failure at creation time. The
			// AUTHORITATIVE gate is the atomic guarded INSERT at accept (R4):
			// pending invites never count toward the cap.
			const [access, used] = await Promise.all([
				resolveAccess(c.env, workspaceId),
				memberCount(c.env, workspaceId),
			]);
			if (!isWithinLimit(used, access.entitlements.maxMembers)) {
				return c.json({ error: "member_limit_reached" }, 402);
			}

			const email = body.email.toLowerCase();

			// Re-issue replaces prior: one active token per (workspace, email) —
			// order-verification's rule. Old links then die at the burn guard.
			await db(c.env)
				.update(workspaceInvite)
				.set({ revokedAt: new Date() })
				.where(
					and(
						eq(workspaceInvite.workspaceId, workspaceId),
						eq(workspaceInvite.email, email),
						isNull(workspaceInvite.acceptedAt),
						isNull(workspaceInvite.revokedAt),
					),
				);

			const token = generateInviteToken();
			const tokenHash = await sha256Hex(token);
			// Store BEFORE send — a failed email leaves a revocable pending
			// invite (the recoverable failure), never a live link with no row.
			const [invite] = await db(c.env)
				.insert(workspaceInvite)
				.values({
					workspaceId,
					email,
					role: body.role,
					tokenHash,
					createdBy: userId,
					expiresAt: new Date(Date.now() + INVITE_TTL_SECONDS * 1000),
				})
				.returning({
					id: workspaceInvite.id,
					email: workspaceInvite.email,
					role: workspaceInvite.role,
					expiresAt: workspaceInvite.expiresAt,
					createdAt: workspaceInvite.createdAt,
				});

			const [ws, inviter] = await Promise.all([
				db(c.env).query.workspace.findFirst({
					where: (w, { eq: e }) => e(w.id, workspaceId),
					columns: { name: true },
				}),
				db(c.env).query.user.findFirst({
					where: (u, { eq: e }) => e(u.id, userId),
					columns: { name: true },
				}),
			]);

			const dashboard = c.env.vars.DASHBOARD_URL || "http://localhost:3001";
			// The plaintext link exists in THIS response and the email, nowhere
			// else — never in the list, the preview, a log line, or analytics.
			const link = `${dashboard}/invite/${token}`;
			let emailSent = true;
			try {
				await sendEmail(c.env, {
					to: email,
					// The body carries the bearer link: no dev-fallback body log, no
					// provider error body in the thrown error.
					sensitive: true,
					...buildInviteEmail({
						workspaceName: ws?.name ?? "your workspace",
						inviterName: inviter?.name ?? null,
						role: body.role,
						link,
					}),
				});
			} catch (err) {
				// Keep the invite: the operator still has the link in this response.
				emailSent = false;
				console.error("invite: email send failed", err);
			}

			captureInBackground(c, {
				event: ANALYTICS_EVENTS.inviteSent,
				distinctId: workspaceId,
				properties: { workspace_id: workspaceId, role: body.role },
			});

			return c.json({ invite, link, emailSent });
		},
	)
	.post(
		"/invites/:id/revoke",
		requireSession,
		requireWorkspace,
		requireRole("admin"),
		async (c) => {
			const workspaceId = c.get("workspaceId");
			const { id } = c.req.param();
			const revoked = await db(c.env)
				.update(workspaceInvite)
				.set({ revokedAt: new Date() })
				.where(
					and(
						eq(workspaceInvite.id, id),
						eq(workspaceInvite.workspaceId, workspaceId),
						isNull(workspaceInvite.acceptedAt),
						isNull(workspaceInvite.revokedAt),
					),
				)
				.returning({ id: workspaceInvite.id });
			if (revoked.length === 0) {
				return c.json({ error: "not found" }, 404);
			}
			return c.json({ ok: true });
		},
	)
	.post(
		"/invites/preview",
		requireSession,
		zValidator("json", tokenInput),
		async (c) => {
			const gate = await rateLimit(
				c.env,
				`invite-preview:${clientIp(c)}`,
				PREVIEW_PER_IP_MAX,
				3600,
				{ failClosed: true },
			);
			if (!gate.ok) return c.json({ error: "rate limit exceeded" }, 429);
			const { token } = c.req.valid("json");
			const invite = await findByToken(c.env, token);
			if (!invite) return c.json({ error: "invalid_invite" }, 404);
			const gone = classifyGone(invite);
			if (gone) return c.json({ error: gone }, 410);
			const [ws, inviter] = await Promise.all([
				db(c.env).query.workspace.findFirst({
					where: (w, { eq: e }) => e(w.id, invite.workspaceId),
					columns: { name: true },
				}),
				invite.createdBy
					? db(c.env).query.user.findFirst({
							where: (u, { eq: e }) => e(u.id, invite.createdBy!),
							columns: { name: true },
						})
					: Promise.resolve(undefined),
			]);
			return c.json({
				workspaceName: ws?.name ?? "a workspace",
				role: invite.role,
				email: invite.email,
				inviterName: inviter?.name ?? null,
			});
		},
	)
	.post(
		"/invites/accept",
		requireSession,
		zValidator("json", tokenInput),
		async (c) => {
			const gate = await rateLimit(
				c.env,
				`invite-accept:${clientIp(c)}`,
				ACCEPT_PER_IP_MAX,
				3600,
				{ failClosed: true },
			);
			if (!gate.ok) return c.json({ error: "rate limit exceeded" }, 429);

			const userId = c.get("userId");
			const { token } = c.req.valid("json");
			// Deliberately NO x-workspace-id here: the token names the workspace
			// (R8 — the header must never influence which workspace is joined).
			const invite = await findByToken(c.env, token);
			if (!invite) return c.json({ error: "invalid_invite" }, 404);
			// Deliberately no state classification here: the burn UPDATE below is
			// the SINGLE authority on used/revoked/expired — a pre-check from this
			// read would be a second, racy copy of the same decision.

			const existing = await db(c.env).query.member.findFirst({
				where: (m, { and: a, eq: e }) =>
					a(e(m.userId, userId), e(m.workspaceId, invite.workspaceId)),
			});
			if (existing) {
				return c.json(
					{ error: "already_member", workspaceId: invite.workspaceId },
					409,
				);
			}

			const access = await resolveAccess(c.env, invite.workspaceId);
			const cap = access.entitlements.maxMembers;

			// 1) Burn FIRST — the guarded single-statement UPDATE owns single-use.
			// Two bearers of one forwarded link must never both reach the seat
			// insert, so possession is settled before any seat is taken.
			const burned = await db(c.env)
				.update(workspaceInvite)
				.set({ acceptedAt: new Date(), acceptedBy: userId })
				.where(
					and(
						eq(workspaceInvite.id, invite.id),
						isNull(workspaceInvite.acceptedAt),
						isNull(workspaceInvite.revokedAt),
						gt(workspaceInvite.expiresAt, new Date()),
					),
				)
				.returning({ id: workspaceInvite.id });
			if (burned.length === 0) {
				// Lost the burn race (or revoked between read and burn).
				const current = await db(c.env).query.workspaceInvite.findFirst({
					where: (i, { eq: e }) => e(i.id, invite.id),
				});
				const why = current
					? (classifyGone(current) ?? "invite_used")
					: "invalid_invite";
				return c.json({ error: why }, 410);
			}

			// The row's role decides the membership we mint, and nothing in SQLite
			// constrains that column to the enum — a hand-inserted invite row (prod
			// has hand-inserted MEMBER rows) could carry 'owner'. Re-validate here
			// so the only roles this endpoint can ever grant are the invitable two.
			const grantedRole = invite.role === "admin" ? "admin" : "agent";

			// 2) Seat-guarded INSERT — count guard and insert are ONE statement
			// (#146's per-statement atomicity), so parallel accepts cannot
			// overshoot the cap. RETURNING says whether this request won a seat.
			let inserted: unknown[];
			try {
				inserted = await db(c.env).all(sql`
					INSERT INTO member (id, workspace_id, user_id, role, created_at)
					SELECT ${crypto.randomUUID()}, ${invite.workspaceId}, ${userId}, ${grantedRole}, unixepoch()
					WHERE (SELECT COUNT(*) FROM member WHERE workspace_id = ${invite.workspaceId}) < ${cap}
					RETURNING id
				`);
			} catch (err) {
				if (isUniqueViolation(err)) {
					// Raced our own pre-check: the user IS a member. The invite
					// stays burned — what it promised (membership) already holds.
					return c.json(
						{ error: "already_member", workspaceId: invite.workspaceId },
						409,
					);
				}
				await unburn(c.env, invite.id, userId);
				throw err;
			}
			if (inserted.length === 0) {
				// Seat lost: compensate so the invite survives a plan upgrade
				// (prefer the recoverable failure — order-verification's rule).
				await unburn(c.env, invite.id, userId);
				return c.json({ error: "member_limit_reached" }, 402);
			}

			captureInBackground(c, {
				event: ANALYTICS_EVENTS.inviteAccepted,
				distinctId: invite.workspaceId,
				properties: { workspace_id: invite.workspaceId, role: grantedRole },
			});
			return c.json({ workspaceId: invite.workspaceId });
		},
	);
