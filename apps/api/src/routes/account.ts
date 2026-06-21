import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSession } from "@/middleware/session";

import { eq, user } from "@llmchat/db";

import type { AppContext } from "@/env";

// UPDATE validator: a single required field, NO `.partial()`/`.default()` (the
// Zod-v4 footgun where a default fires on an absent key). `.trim()` runs before
// `.min(1)`, so a whitespace-only name fails validation (400). Unknown keys
// (e.g. an attempt to smuggle an `id`) are stripped by Zod — the handler never
// reads anything but `name` from the body.
const updateInput = z.object({
	name: z.string().trim().min(1).max(100),
});

/**
 * The caller's OWN account. Every handler derives the user from the session
 * (requireSession sets `userId`); no user id is ever accepted from the request,
 * so these endpoints can only ever read/mutate the signed-in user. PR2 extends
 * GET with deletion impact and adds the destructive DELETE — kept separate so
 * the dangerous path is reviewed in isolation.
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
		return c.json({ name: me.name, email: me.email });
	})
	.patch("/account", zValidator("json", updateInput), async (c) => {
		const userId = c.get("userId");
		const { name } = c.req.valid("json");
		// Name isn't auth-sensitive, so a direct column update is simplest and
		// keeps the write keyed to the SESSION user — never an id from the body.
		const [updated] = await db(c.env)
			.update(user)
			.set({ name: name.trim(), updatedAt: new Date() })
			.where(eq(user.id, userId))
			.returning({ name: user.name, email: user.email });
		return c.json({ name: updated!.name, email: updated!.email });
	});
