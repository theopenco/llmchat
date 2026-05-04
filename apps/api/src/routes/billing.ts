import { Hono } from "hono";

import type { AppContext } from "@/env";

// Stub: Stripe checkout + webhook. Wire up once a Stripe product is created.
export const billing = new Hono<AppContext>()
	.post("/billing/checkout", (c) => c.json({ error: "not implemented" }, 501))
	.post("/webhooks/stripe", (c) => c.json({ error: "not implemented" }, 501));
