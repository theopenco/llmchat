// Single source of truth for the integration kinds the agent can act through,
// and the zod schemas that validate each kind's `integration.config` JSON blob
// before it is written. Shared so the api (validation + tool wiring), the
// dashboard (settings forms), and the Shopify app (register call) can never
// drift on the config shape.

import { z } from "zod";

export const INTEGRATION_KINDS = ["calcom", "shopify"] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

export function isIntegrationKind(v: unknown): v is IntegrationKind {
	return (
		typeof v === "string" &&
		(INTEGRATION_KINDS as readonly string[]).includes(v)
	);
}

// ── Cal.com ───────────────────────────────────────────────────────────────
// The agent books calls against ONE event type. Zoom (or Meet, or a phone
// call) comes from that event type's configured location in Cal.com — the
// booking response's `location` carries the join link back to the visitor.
export const calcomConfigSchema = z.object({
	/** Cal.com API key (cal_…) — server-side only, masked in dashboard reads. */
	apiKey: z.string().min(6).max(256),
	/** The numeric event type id the agent books. */
	eventTypeId: z.number().int().positive(),
	/** IANA time zone slots are quoted in (visitors see these times). */
	timeZone: z.string().min(1).max(64).default("UTC"),
	// NOTE: there is deliberately NO `apiBase` here. A stored, admin-writable
	// base URL is an SSRF + credential-exfiltration vector — the agent attaches
	// the raw Bearer key to every request, so a config-supplied host could
	// exfiltrate it. The Cal.com host is pinned to api.cal.com in calcom.ts; a
	// trusted, server-set env override (CALCOM_API_BASE) exists for tests/
	// self-hosters and is NOT part of this untrusted config blob.
});
export type CalcomConfig = z.infer<typeof calcomConfigSchema>;

// ── Shopify ───────────────────────────────────────────────────────────────
// Admin API access for order lookup + returns. Needs read_orders and
// write_returns scopes. `accessToken` is either the connector app's offline
// token (pushed via the connect-code flow) or a custom-app token pasted by a
// self-hosting merchant.
export const shopifyConfigSchema = z.object({
	/** myshopify domain, e.g. acme-tools.myshopify.com. */
	shopDomain: z
		.string()
		.min(4)
		.max(255)
		.regex(
			/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i,
			"must be a *.myshopify.com domain",
		),
	/** Admin API access token (shpat_…/shpca_…) — server-side only. */
	accessToken: z.string().min(6).max(256),
	// NOTE: there is deliberately NO `apiBase` here. See calcomConfigSchema —
	// same SSRF/token-exfiltration reasoning. The Shopify host is always derived
	// from the regex-validated `shopDomain` (shopify-admin.ts); a trusted,
	// server-set env override (SHOPIFY_API_BASE) exists for tests/self-hosters.
});
export type ShopifyConfig = z.infer<typeof shopifyConfigSchema>;

export const integrationConfigSchemas = {
	calcom: calcomConfigSchema,
	shopify: shopifyConfigSchema,
} as const;

/** Parse + validate a config blob for a kind. Throws ZodError on mismatch. */
export function parseIntegrationConfig<K extends IntegrationKind>(
	kind: K,
	config: unknown,
): z.infer<(typeof integrationConfigSchemas)[K]> {
	return integrationConfigSchemas[kind].parse(config) as z.infer<
		(typeof integrationConfigSchemas)[K]
	>;
}

/** Last-4 mask for a stored secret: "cal_live_abc123" → "••••3123"-style. */
export function maskSecret(secret: string): string {
	const tail = secret.slice(-4);
	return `••••${tail}`;
}

/**
 * The dashboard-safe view of an integration row: everything except raw
 * credentials. `summary` is a human label for the connected account/resource
 * ("event type 123 · UTC", "acme.myshopify.com"), `secretHint` the masked tail.
 */
export interface IntegrationView {
	kind: IntegrationKind;
	enabled: boolean;
	summary: string;
	secretHint: string;
	updatedAt: number;
}
