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
	isModelAllowed,
	isOverResponseQuota,
	isWithinLimit,
	planEntitlements,
	type Plan,
} from "@llmchat/shared";

import type { AppContext } from "@/env";

type Env = AppContext["Bindings"];

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

/** Whether the workspace may create one more project at its current plan. */
export async function canCreateProject(
	env: Env,
	workspaceId: string,
): Promise<boolean> {
	const [plan, used] = await Promise.all([
		workspacePlan(env, workspaceId),
		projectCount(env, workspaceId),
	]);
	return isWithinLimit(used, planEntitlements(plan).maxProjects);
}

/** Whether `model` is selectable for this workspace's current plan (Starter is
 * limited to basic models; Growth/Scale get all). */
export async function isModelAllowedForWorkspace(
	env: Env,
	workspaceId: string,
	model: string,
): Promise<boolean> {
	return isModelAllowed(await workspacePlan(env, workspaceId), model);
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
