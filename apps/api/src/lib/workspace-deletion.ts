// The destructive core of account deletion. Everything here is EXPLICIT and
// set-based — we never rely on `onDelete: cascade` (FK enforcement is unreliable
// across the D1 emulator vs prod, and this operation is irreversible). The
// statement builders are separated from the executors so a test can render the
// exact generated SQL and prove, under PRAGMA foreign_keys=OFF, that every child
// row is removed by our own deletes rather than by a cascade.

import { retrieveSubscription } from "@/lib/stripe";

import {
	account,
	and,
	conversation,
	conversationTag,
	count,
	eq,
	inArray,
	member,
	message,
	ne,
	passkey,
	project,
	readStatus,
	session,
	source,
	systemPrompt,
	tag,
	usageEvent,
	user,
	verification,
	workspace,
	type Database,
} from "@llmchat/db";
import { isPaidPlan } from "@llmchat/shared";

import type { AppContext } from "@/env";

type Env = AppContext["Bindings"];

/** A workspace the caller solely owns, with the fields the sub-gate needs. */
export interface OwnedWorkspace {
	id: string;
	plan: string;
	stripeSubscriptionId: string | null;
}

// ─── Statement builders (pure: build, don't execute) ──────────────────────────

/**
 * The 11-step, child→parent, set-based delete set for ONE workspace. Every
 * statement is `DELETE … WHERE … IN (SELECT …)` (or a direct workspace_id), so
 * the statement count is constant regardless of data volume. Child→parent order
 * means it's also correct if FK enforcement is unexpectedly ON (no RESTRICT).
 */
export function workspaceDeleteStatements(db: Database, wsId: string) {
	// Fresh subqueries per use so a builder is never shared/mutated across stmts.
	const projIds = () =>
		db
			.select({ id: project.id })
			.from(project)
			.where(eq(project.workspaceId, wsId));
	const convIds = () =>
		db
			.select({ id: conversation.id })
			.from(conversation)
			.where(inArray(conversation.projectId, projIds()));

	return [
		db
			.delete(conversationTag)
			.where(inArray(conversationTag.conversationId, convIds())),
		db.delete(readStatus).where(inArray(readStatus.conversationId, convIds())),
		db.delete(message).where(inArray(message.conversationId, convIds())),
		db.delete(source).where(inArray(source.projectId, projIds())),
		db.delete(systemPrompt).where(inArray(systemPrompt.projectId, projIds())),
		db.delete(usageEvent).where(eq(usageEvent.workspaceId, wsId)),
		db.delete(conversation).where(inArray(conversation.projectId, projIds())),
		db.delete(tag).where(eq(tag.workspaceId, wsId)),
		db.delete(project).where(eq(project.workspaceId, wsId)),
		db.delete(member).where(eq(member.workspaceId, wsId)),
		db.delete(workspace).where(eq(workspace.id, wsId)),
	];
}

/**
 * The user-row delete set, run AFTER all solely-owned workspaces are gone. Nulls
 * the user off any surviving authored messages (FK has no cascade), removes every
 * user-referencing row, sweeps email verification tokens, and deletes the user
 * LAST so a partial failure never orphans an owner.
 */
export function userDeleteStatements(
	db: Database,
	userId: string,
	email: string,
) {
	return [
		db
			.update(message)
			.set({ authorUserId: null })
			.where(eq(message.authorUserId, userId)),
		db.delete(member).where(eq(member.userId, userId)),
		db.delete(readStatus).where(eq(readStatus.userId, userId)),
		db.delete(account).where(eq(account.userId, userId)),
		db.delete(passkey).where(eq(passkey.userId, userId)),
		db.delete(verification).where(eq(verification.identifier, email)),
		db.delete(session).where(eq(session.userId, userId)),
		db.delete(user).where(eq(user.id, userId)),
	];
}

// drizzle's `batch` wants a non-empty tuple; our builders are a plain array.
type BatchInput = Parameters<Database["batch"]>[0];

/** Atomically delete one workspace's data (one D1 batch = one transaction). */
export function deleteWorkspaceCascade(db: Database, wsId: string) {
	return db.batch(workspaceDeleteStatements(db, wsId) as unknown as BatchInput);
}

/** Atomically run the user-row delete set (one D1 batch). */
export function deleteUserRows(db: Database, userId: string, email: string) {
	return db.batch(
		userDeleteStatements(db, userId, email) as unknown as BatchInput,
	);
}

// ─── Ownership resolution ─────────────────────────────────────────────────────

export interface Ownership {
	/** Workspaces the user owns AND no other owner exists → delete entirely. */
	solelyOwned: OwnedWorkspace[];
	/** Workspaces the user owns but a DIFFERENT owner also exists → guard/abort. */
	coOwned: string[];
}

/**
 * Split the user's owner memberships into solely-owned (safe to delete) vs
 * co-owned (another owner exists — must never be silently deleted). Non-owner
 * memberships need no special handling: the user-delete set drops every `member`
 * row by userId.
 */
export async function resolveOwnership(
	db: Database,
	userId: string,
): Promise<Ownership> {
	const owned = await db
		.select({ workspaceId: member.workspaceId })
		.from(member)
		.where(and(eq(member.userId, userId), eq(member.role, "owner")));

	const solelyOwned: OwnedWorkspace[] = [];
	const coOwned: string[] = [];
	for (const { workspaceId } of owned) {
		const [{ n }] = await db
			.select({ n: count() })
			.from(member)
			.where(
				and(
					eq(member.workspaceId, workspaceId),
					eq(member.role, "owner"),
					ne(member.userId, userId),
				),
			);
		if (n > 0) {
			coOwned.push(workspaceId);
			continue;
		}
		const ws = await db.query.workspace.findFirst({
			where: (w, { eq: e }) => e(w.id, workspaceId),
			columns: { id: true, plan: true, stripeSubscriptionId: true },
		});
		if (ws) solelyOwned.push(ws);
	}
	return { solelyOwned, coOwned };
}

// ─── Subscription gate (live + fail-closed) ───────────────────────────────────

/** Stripe statuses that mean the workspace still has/owes access → block delete
 * until canceled. (canceled / incomplete / incomplete_expired ⇒ allow.) */
const BLOCKING_STATUSES = new Set([
	"active",
	"trialing",
	"past_due",
	"unpaid",
	"paused",
]);

export type GateReason =
	| "active_subscription"
	| "billing_unverified"
	| "billing_drift";

export interface GateResult {
	blocked: boolean;
	reason?: GateReason;
	workspaceId?: string;
}

/**
 * Decide whether ONE workspace blocks deletion:
 * - no sub id AND not a paid plan ⇒ ALLOW with NO Stripe call (a missing
 *   STRIPE_SECRET_KEY must never block a free user);
 * - sub id set ⇒ live `retrieveSubscription`: blocking status ⇒ block; missing
 *   secret or any Stripe error ⇒ FAIL CLOSED ("couldn't verify");
 * - paid plan but no sub id (data drift) ⇒ FAIL CLOSED ("contact support").
 */
export async function gateWorkspace(
	ws: OwnedWorkspace,
	env: Env,
): Promise<GateResult> {
	const paid = isPaidPlan(ws.plan);
	if (!ws.stripeSubscriptionId && !paid) return { blocked: false };

	if (ws.stripeSubscriptionId) {
		const secret = env.vars.STRIPE_SECRET_KEY;
		if (!secret?.trim()) {
			return {
				blocked: true,
				reason: "billing_unverified",
				workspaceId: ws.id,
			};
		}
		try {
			const sub = await retrieveSubscription(secret, ws.stripeSubscriptionId);
			return BLOCKING_STATUSES.has(sub.status)
				? { blocked: true, reason: "active_subscription", workspaceId: ws.id }
				: { blocked: false };
		} catch (err) {
			console.error(
				"account-delete: Stripe verify failed; failing closed",
				err,
			);
			return {
				blocked: true,
				reason: "billing_unverified",
				workspaceId: ws.id,
			};
		}
	}

	// Paid plan, no sub id to verify → conservative block.
	return { blocked: true, reason: "billing_drift", workspaceId: ws.id };
}

/** Run the gate across every solely-owned workspace; returns the FIRST blocker
 * (or unblocked). Any block ⇒ the caller aborts before deleting anything. */
export async function assertDeletable(
	workspaces: OwnedWorkspace[],
	env: Env,
): Promise<GateResult> {
	for (const ws of workspaces) {
		const r = await gateWorkspace(ws, env);
		if (r.blocked) return r;
	}
	return { blocked: false };
}

// ─── Impact counts (for the danger zone) ──────────────────────────────────────

export interface DeletionImpact {
	workspaces: number;
	projects: number;
	conversations: number;
	sources: number;
	members: number;
}

const EMPTY_IMPACT: DeletionImpact = {
	workspaces: 0,
	projects: 0,
	conversations: 0,
	sources: 0,
	members: 0,
};

/** Counts across the user's solely-owned workspaces — what deletion will remove. */
export async function ownedWorkspaceImpact(
	db: Database,
	wsIds: string[],
): Promise<DeletionImpact> {
	if (wsIds.length === 0) return EMPTY_IMPACT;
	const projIds = () =>
		db
			.select({ id: project.id })
			.from(project)
			.where(inArray(project.workspaceId, wsIds));

	const [[projects], [members], [conversations], [sources]] = await Promise.all(
		[
			db
				.select({ n: count() })
				.from(project)
				.where(inArray(project.workspaceId, wsIds)),
			db
				.select({ n: count() })
				.from(member)
				.where(inArray(member.workspaceId, wsIds)),
			db
				.select({ n: count() })
				.from(conversation)
				.where(inArray(conversation.projectId, projIds())),
			db
				.select({ n: count() })
				.from(source)
				.where(inArray(source.projectId, projIds())),
		],
	);

	return {
		workspaces: wsIds.length,
		projects: projects?.n ?? 0,
		members: members?.n ?? 0,
		conversations: conversations?.n ?? 0,
		sources: sources?.n ?? 0,
	};
}
