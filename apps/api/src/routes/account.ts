import { zValidator } from "@hono/zod-validator";
import { verifyPassword } from "better-auth/crypto";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSession } from "@/middleware/session";
import {
	assertDeletable,
	deleteUserRows,
	deleteWorkspaceCascade,
	ownedWorkspaceImpact,
	resolveOwnership,
} from "@/lib/workspace-deletion";

import { eq, user } from "@llmchat/db";
import { isPaidPlan } from "@llmchat/shared";

import type { AppContext } from "@/env";

// UPDATE validator: a single required field, NO `.partial()`/`.default()` (the
// Zod-v4 footgun). `.trim()` before `.min(1)` rejects whitespace-only names.
const updateInput = z.object({
	name: z.string().trim().min(1).max(100),
});

// DELETE validator: a confirmation email (compared to the SESSION email, never a
// target selector) and an optional password (required only when the user has a
// credential account). No user id is ever accepted.
const deleteInput = z.object({
	confirmEmail: z.string().min(1),
	password: z.string().optional(),
});

/** Whether the signed-in user has a usable password (a `credential` account with
 * a non-null hash). Drives both the GET `hasPassword` flag and the DELETE re-auth. */
async function findCredentialPassword(
	env: AppContext["Bindings"],
	userId: string,
): Promise<string | null> {
	const cred = await db(env).query.account.findFirst({
		where: (a, { and, eq: e, isNotNull }) =>
			and(
				e(a.userId, userId),
				e(a.providerId, "credential"),
				isNotNull(a.password),
			),
		columns: { password: true },
	});
	return cred?.password ?? null;
}

/**
 * The caller's OWN account. Every handler derives the user from the session
 * (requireSession sets `userId`); no user id is ever accepted from the request,
 * so these endpoints can only ever read/mutate/delete the signed-in user.
 */
export const account = new Hono<AppContext>()
	.use("*", requireSession)
	.get("/account", async (c) => {
		const userId = c.get("userId");
		const me = await db(c.env).query.user.findFirst({
			where: (u, { eq: e }) => e(u.id, userId),
			columns: { name: true, email: true },
		});
		if (!me) return c.json({ error: "not found" }, 404);

		const hasPassword = (await findCredentialPassword(c.env, userId)) !== null;
		const { solelyOwned, coOwned } = await resolveOwnership(db(c.env), userId);
		const impact = await ownedWorkspaceImpact(
			db(c.env),
			solelyOwned.map((w) => w.id),
		);

		// Blocker HINTS from stored fields — deliberately NO Stripe call on a page
		// load. The authoritative live + fail-closed check runs in DELETE. A
		// properly-canceled workspace has stripeSubscriptionId nulled by the webhook,
		// so a lingering id ⇒ likely still subscribed; paid plan with no id ⇒ drift.
		return c.json({
			name: me.name,
			email: me.email,
			hasPassword,
			impact,
			blockers: {
				activeSubscription: solelyOwned.some((w) => !!w.stripeSubscriptionId),
				drift: solelyOwned.some(
					(w) => isPaidPlan(w.plan) && !w.stripeSubscriptionId,
				),
				coOwner: coOwned.length > 0,
			},
		});
	})
	.patch("/account", zValidator("json", updateInput), async (c) => {
		const userId = c.get("userId");
		const { name } = c.req.valid("json");
		// Direct column update, keyed to the SESSION user — never an id from the body.
		const [updated] = await db(c.env)
			.update(user)
			.set({ name: name.trim(), updatedAt: new Date() })
			.where(eq(user.id, userId))
			.returning({ name: user.name, email: user.email });
		return c.json({ name: updated!.name, email: updated!.email });
	})
	// Permanently delete the caller's account + every workspace they solely own.
	// Irreversible. Order is fixed: confirm → re-auth → ownership/co-owner guard →
	// live sub-gate (fail-closed) → per-workspace cascade → user rows (user LAST).
	// Every step is self-from-session and explicit (never relies on FK cascade).
	.delete("/account", zValidator("json", deleteInput), async (c) => {
		const userId = c.get("userId");
		const { confirmEmail, password } = c.req.valid("json");
		const d = db(c.env);

		const me = await d.query.user.findFirst({
			where: (u, { eq: e }) => e(u.id, userId),
			columns: { email: true },
		});
		if (!me) return c.json({ error: "not found" }, 404);

		// 1. Type-to-confirm: the email must match the session user's (case-insensitive).
		if (confirmEmail.trim().toLowerCase() !== me.email.toLowerCase()) {
			return c.json({ error: "email_mismatch" }, 400);
		}

		// 2. Re-auth: if a credential account exists, verify the password with
		//    Better-Auth's native verify (never hand-rolled). OAuth-only ⇒ skip.
		const credentialHash = await findCredentialPassword(c.env, userId);
		if (credentialHash) {
			if (!password) return c.json({ error: "password_required" }, 403);
			const ok = await verifyPassword({ hash: credentialHash, password });
			if (!ok) return c.json({ error: "invalid_password" }, 403);
		}

		// 3. Ownership + co-owner guard — never silently delete a shared workspace.
		const { solelyOwned, coOwned } = await resolveOwnership(d, userId);
		if (coOwned.length > 0) return c.json({ error: "co_owner" }, 409);

		// 4. Live, fail-closed subscription gate — BEFORE any delete.
		const gate = await assertDeletable(solelyOwned, c.env);
		if (gate.blocked) return c.json({ error: gate.reason }, 409);

		// 5. Per-workspace atomic cascade (explicit, child→parent).
		for (const ws of solelyOwned) {
			await deleteWorkspaceCascade(d, ws.id);
		}
		// 6. User rows — user deleted LAST (deleteUserRows nulls authored messages,
		//    removes member/read_status/account/passkey/session + sweeps verification
		//    tokens by email, then deletes the user).
		await deleteUserRows(d, userId, me.email);

		return c.json({ ok: true });
	});
