// Server-side billing enforcement glue. The *policy* (what each tier allows)
// lives in @llmchat/shared (BILLING_TIERS / planEntitlements); this module is
// only the DB queries that count usage and the thin decisions that combine the
// two. Routes call these — no enforcement logic is duplicated across routes.
//
// The monthly response counter (startOfUtcMonth + monthlyResponseCount) is
// lifted from the parked flat-plan-limits branch, with the `and()` filter fix
// preserved. See memory: parked-flat-plan-limits, business-model-usage-based.

import { db } from "@/lib/db";

import { and, count, eq, gte, member, project, usageEvent } from "@llmchat/db";
import {
	INTERNAL_ENTITLEMENTS,
	isInternalEmail,
	isModelAllowed,
	isOverResponseQuota,
	isWithinLimit,
	planEntitlements,
	type Plan,
	type TierEntitlements,
} from "@llmchat/shared";

import type { AppContext } from "@/env";

type Env = AppContext["Bindings"];

/** The operator's internal/founder email allowlist, parsed from env. Empty when
 * unset — so no workspace is exempt unless explicitly configured. */
export function internalEmails(env: Env): string[] {
	const raw = env.vars.INTERNAL_ACCOUNT_EMAILS;
	if (!raw) return [];
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

export interface WorkspaceAccess {
	/** True when the workspace owner is an internal/founder account — full
	 * access, no paywall, no metering. Resolved server-side from the owner's DB
	 * email vs the env allowlist; never from client input. */
	exempt: boolean;
	/** Stored plan ("internal" when exempt). */
	plan: Plan | string;
	entitlements: TierEntitlements;
	stripeCustomerId: string | null;
}

/**
 * Resolve a workspace's effective access: its plan + entitlements, the Stripe
 * customer (for metering), and whether it's an exempt internal workspace.
 *
 * Exemption is decided by the WORKSPACE OWNER's email (workspace.ownerId →
 * user.email) against the env allowlist — the same non-spoofable path on the
 * public chat endpoint (no session) and the dashboard. The owner-email lookup
 * is skipped entirely when no allowlist is configured (the common case), so it
 * adds no query for normal traffic.
 */
export async function resolveAccess(
	env: Env,
	workspaceId: string,
): Promise<WorkspaceAccess> {
	const ws = await db(env).query.workspace.findFirst({
		where: (w, { eq: e }) => e(w.id, workspaceId),
		columns: { plan: true, ownerId: true, stripeCustomerId: true },
	});
	const stripeCustomerId = ws?.stripeCustomerId ?? null;
	const allow = internalEmails(env);
	if (ws && allow.length > 0) {
		const owner = await db(env).query.user.findFirst({
			where: (u, { eq: e }) => e(u.id, ws.ownerId),
			columns: { email: true },
		});
		if (isInternalEmail(owner?.email, allow)) {
			return {
				exempt: true,
				plan: "internal",
				entitlements: INTERNAL_ENTITLEMENTS,
				stripeCustomerId,
			};
		}
	}
	const plan = ws?.plan ?? "none";
	return {
		exempt: false,
		plan,
		entitlements: planEntitlements(plan),
		stripeCustomerId,
	};
}

/** Unix-seconds timestamp for the first instant of the current UTC month — the
 * window monthly response quotas are measured over. */
export function startOfUtcMonth(now: Date = new Date()): number {
	return Math.floor(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000,
	);
}

/** The workspace's stored plan, or "none" if the row/column is missing. The
 * resolver in @llmchat/shared maps unknown/legacy values to a blocked tier. */
export async function workspacePlan(
	env: Env,
	workspaceId: string,
): Promise<Plan | string> {
	const ws = await db(env).query.workspace.findFirst({
		where: (w, { eq: e }) => e(w.id, workspaceId),
		columns: { plan: true },
	});
	return ws?.plan ?? "none";
}

export async function projectCount(
	env: Env,
	workspaceId: string,
): Promise<number> {
	const [row] = await db(env)
		.select({ n: count() })
		.from(project)
		.where(eq(project.workspaceId, workspaceId));
	return row?.n ?? 0;
}

export async function memberCount(
	env: Env,
	workspaceId: string,
): Promise<number> {
	const [row] = await db(env)
		.select({ n: count() })
		.from(member)
		.where(eq(member.workspaceId, workspaceId));
	return row?.n ?? 0;
}

/** Bot responses metered this calendar month for a workspace. One usageEvent is
 * written per assistant reply, so this is the billable response count. */
export async function monthlyResponseCount(
	env: Env,
	workspaceId: string,
	now?: Date,
): Promise<number> {
	const [row] = await db(env)
		.select({ n: count() })
		.from(usageEvent)
		.where(
			and(
				eq(usageEvent.workspaceId, workspaceId),
				gte(usageEvent.createdAt, new Date(startOfUtcMonth(now) * 1000)),
			),
		);
	return row?.n ?? 0;
}

/** Whether the workspace may create one more project at its current plan.
 * Honors the internal exemption (unlimited) via resolveAccess. */
export async function canCreateProject(
	env: Env,
	workspaceId: string,
): Promise<boolean> {
	const [{ entitlements }, used] = await Promise.all([
		resolveAccess(env, workspaceId),
		projectCount(env, workspaceId),
	]);
	return isWithinLimit(used, entitlements.maxProjects);
}

/** Whether `model` is selectable for this workspace (Starter is limited to
 * basic models; Growth/Scale and exempt workspaces get all). */
export async function isModelAllowedForWorkspace(
	env: Env,
	workspaceId: string,
	model: string,
): Promise<boolean> {
	const { exempt, plan } = await resolveAccess(env, workspaceId);
	return exempt || isModelAllowed(plan, model);
}

/** Whether the workspace may add one more member (seat) at its current plan. */
export async function canAddMember(
	env: Env,
	workspaceId: string,
): Promise<boolean> {
	const [plan, used] = await Promise.all([
		workspacePlan(env, workspaceId),
		memberCount(env, workspaceId),
	]);
	return isWithinLimit(used, planEntitlements(plan).maxMembers);
}

/**
 * Whether this workspace's live agent must be blocked from generating another
 * response right now (fixed-tier quota reached). Plans with overage never
 * block — Stripe meters the excess.
 *
 * FAIL-OPEN: a thrown query (a counting bug, a DB hiccup) resolves to `false`
 * (allow). A metering fault must never take a paying customer's agent offline;
 * the worst case is an unmetered response, which is recoverable, unlike an
 * outage. The error is logged for diagnosis.
 */
export async function isResponseBlocked(
	env: Env,
	workspaceId: string,
	plan: Plan | string,
	now?: Date,
): Promise<boolean> {
	// Overage tier — never hard-blocked; skip the count query entirely.
	if (planEntitlements(plan).allowOverage) return false;
	try {
		const used = await monthlyResponseCount(env, workspaceId, now);
		return isOverResponseQuota(plan, used);
	} catch (err) {
		console.error("plan: response-quota check failed; failing open", err);
		return false;
	}
}
