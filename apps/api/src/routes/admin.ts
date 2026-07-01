import { Hono } from "hono";

import {
	activeSubscriptions,
	buildDayKeys,
	densifySeries,
	estimateMrrUsd,
	tallyPlans,
} from "@/lib/admin-metrics";
import { db } from "@/lib/db";
import { requireGlobalAdmin, resolveAdminIdentity } from "@/middleware/admin";

import {
	conversation,
	count,
	desc,
	eq,
	gte,
	member,
	message,
	project,
	sql,
	usageEvent,
	user,
	workspace,
} from "@llmchat/db";

import type { AppContext } from "@/env";
import type { Database } from "@llmchat/db";

const DAY_MS = 86_400_000;
const SERIES_DAYS = 30;

/** Bound a `?limit=` query to a sane range (default 50). */
function parseLimit(raw: string | undefined, fallback = 50, max = 200): number {
	const n = Number.parseInt(raw ?? "", 10);
	if (!Number.isFinite(n) || n <= 0) return fallback;
	return Math.min(n, max);
}

/** COUNT(*) of a table, optionally since a cutoff on its `created_at`. */
async function countRows(
	d: Database,
	// oxlint-disable-next-line no-explicit-any
	table: any,
	since?: Date,
): Promise<number> {
	const q = d.select({ n: count() }).from(table);
	const rows = since ? await q.where(gte(table.createdAt, since)) : await q;
	return rows[0]?.n ?? 0;
}

/**
 * Internal admin dashboard API — cross-tenant platform metrics (signups,
 * revenue, subscriptions). Every route except `/admin/me` is gated by
 * `requireGlobalAdmin` (platform admins only; see middleware/admin.ts). These
 * are aggregate reads only — no tenant data is mutated here.
 */
export const admin = new Hono<AppContext>()
	// Identity probe for the admin frontend's access gate. Deliberately NOT
	// behind requireGlobalAdmin so a signed-in non-admin gets a clean
	// `{ isAdmin: false }` (→ "access restricted" screen) instead of a bare 403,
	// while a logged-out visitor still gets 401 (→ redirect to sign-in).
	.get("/admin/me", async (c) => {
		const identity = await resolveAdminIdentity(c);
		if (!identity) return c.json({ error: "unauthorized" }, 401);
		return c.json({ email: identity.email, isAdmin: identity.isAdmin });
	})

	// Headline metrics + 30-day signup/usage series + subscription breakdown.
	// One call powers the whole overview page.
	.get("/admin/overview", requireGlobalAdmin, async (c) => {
		const d = db(c.env);
		const now = Date.now();
		const since24h = new Date(now - DAY_MS);
		const since7d = new Date(now - 7 * DAY_MS);
		const since30d = new Date(now - 30 * DAY_MS);

		const dayKeys = buildDayKeys(now, SERIES_DAYS);
		const signupDay = sql<string>`date(${user.createdAt}, 'unixepoch')`;
		const usageDay = sql<string>`date(${usageEvent.createdAt}, 'unixepoch')`;

		const [
			usersTotal,
			usersNew24h,
			usersNew7d,
			usersNew30d,
			workspacesTotal,
			projectsTotal,
			conversationsTotal,
			messagesTotal,
			subRows,
			usageTotals,
			usage30,
			signupRows,
			usageRows,
			recentUsers,
		] = await Promise.all([
			countRows(d, user),
			countRows(d, user, since24h),
			countRows(d, user, since7d),
			countRows(d, user, since30d),
			countRows(d, workspace),
			countRows(d, project),
			countRows(d, conversation),
			countRows(d, message),
			d
				.select({ plan: workspace.plan, n: count() })
				.from(workspace)
				.groupBy(workspace.plan),
			d
				.select({
					responses: count(),
					tokens: sql<number>`coalesce(sum(${usageEvent.promptTokens} + ${usageEvent.completionTokens}), 0)`,
					cost: sql<number>`coalesce(sum(${usageEvent.costUsd}), 0)`,
				})
				.from(usageEvent),
			d
				.select({
					responses: count(),
					cost: sql<number>`coalesce(sum(${usageEvent.costUsd}), 0)`,
				})
				.from(usageEvent)
				.where(gte(usageEvent.createdAt, since30d)),
			d
				.select({ day: signupDay, n: count() })
				.from(user)
				.where(gte(user.createdAt, since30d))
				.groupBy(signupDay),
			d
				.select({
					day: usageDay,
					responses: count(),
					cost: sql<number>`coalesce(sum(${usageEvent.costUsd}), 0)`,
				})
				.from(usageEvent)
				.where(gte(usageEvent.createdAt, since30d))
				.groupBy(usageDay),
			d
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					createdAt: user.createdAt,
				})
				.from(user)
				.orderBy(desc(user.createdAt))
				.limit(8),
		]);

		const planCounts = tallyPlans(subRows);

		const signupsByDay: Record<string, { count: number }> = {};
		for (const r of signupRows) signupsByDay[r.day] = { count: r.n };

		const usageByDay: Record<string, { responses: number; cost: number }> = {};
		for (const r of usageRows) {
			usageByDay[r.day] = { responses: r.responses, cost: r.cost ?? 0 };
		}

		return c.json({
			users: {
				total: usersTotal,
				new24h: usersNew24h,
				new7d: usersNew7d,
				new30d: usersNew30d,
			},
			subscriptions: {
				byPlan: planCounts,
				activePaid: activeSubscriptions(planCounts),
				estMrrUsd: estimateMrrUsd(planCounts),
				estArrUsd: estimateMrrUsd(planCounts) * 12,
			},
			usage: {
				responsesTotal: usageTotals[0]?.responses ?? 0,
				responses30d: usage30[0]?.responses ?? 0,
				tokensTotal: usageTotals[0]?.tokens ?? 0,
				costUsdTotal: usageTotals[0]?.cost ?? 0,
				costUsd30d: usage30[0]?.cost ?? 0,
			},
			content: {
				workspaces: workspacesTotal,
				projects: projectsTotal,
				conversations: conversationsTotal,
				messages: messagesTotal,
			},
			signupsSeries: densifySeries(dayKeys, signupsByDay, { count: 0 }),
			usageSeries: densifySeries(dayKeys, usageByDay, {
				responses: 0,
				cost: 0,
			}),
			recentUsers,
		});
	})

	// Workspaces table: plan, owner, members/projects, and 30-day usage/cost.
	.get("/admin/workspaces", requireGlobalAdmin, async (c) => {
		const d = db(c.env);
		const limit = parseLimit(c.req.query("limit"));
		const since30d = new Date(Date.now() - 30 * DAY_MS);

		const [rows, projRows, memRows, respRows] = await Promise.all([
			d
				.select({
					id: workspace.id,
					name: workspace.name,
					plan: workspace.plan,
					createdAt: workspace.createdAt,
					ownerEmail: user.email,
					hasSubscription: workspace.stripeSubscriptionId,
				})
				.from(workspace)
				.leftJoin(user, eq(user.id, workspace.ownerId))
				.orderBy(desc(workspace.createdAt))
				.limit(limit),
			d
				.select({ id: project.workspaceId, n: count() })
				.from(project)
				.groupBy(project.workspaceId),
			d
				.select({ id: member.workspaceId, n: count() })
				.from(member)
				.groupBy(member.workspaceId),
			d
				.select({
					id: usageEvent.workspaceId,
					n: count(),
					cost: sql<number>`coalesce(sum(${usageEvent.costUsd}), 0)`,
				})
				.from(usageEvent)
				.where(gte(usageEvent.createdAt, since30d))
				.groupBy(usageEvent.workspaceId),
		]);

		const projById = new Map(projRows.map((r) => [r.id, r.n]));
		const memById = new Map(memRows.map((r) => [r.id, r.n]));
		const respById = new Map(respRows.map((r) => [r.id, r]));

		const workspaces = rows.map((w) => ({
			id: w.id,
			name: w.name,
			plan: w.plan,
			ownerEmail: w.ownerEmail,
			hasSubscription: Boolean(w.hasSubscription),
			members: memById.get(w.id) ?? 0,
			projects: projById.get(w.id) ?? 0,
			responses30d: respById.get(w.id)?.n ?? 0,
			costUsd30d: respById.get(w.id)?.cost ?? 0,
			createdAt: w.createdAt,
		}));

		return c.json({ workspaces });
	})

	// Users table: identity, verification, platform role, signup date.
	.get("/admin/users", requireGlobalAdmin, async (c) => {
		const d = db(c.env);
		const limit = parseLimit(c.req.query("limit"));
		const base = {
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			createdAt: user.createdAt,
		};
		// `role` isn't modeled on the Drizzle `user` table (see schema.ts), so it's
		// read via a raw `sql` projection — guarded the same way as the middleware.
		// requireGlobalAdmin can pass via the ADMIN_EMAILS allowlist WITHOUT the
		// 0017 column existing (e.g. a migration-less preview), so a bare read could
		// 500; on failure, fall back to the least-privileged 'user'.
		try {
			const users = await d
				.select({ ...base, role: sql<string>`role` })
				.from(user)
				.orderBy(desc(user.createdAt))
				.limit(limit);
			return c.json({ users });
		} catch {
			const rows = await d
				.select(base)
				.from(user)
				.orderBy(desc(user.createdAt))
				.limit(limit);
			return c.json({ users: rows.map((u) => ({ ...u, role: "user" })) });
		}
	});
