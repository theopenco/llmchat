/**
 * Server-side helpers for the Clanker connection flow (docs/shopify-app-plan.md §5).
 *
 * The project key lives in an app-data metafield on the AppInstallation:
 * hidden from the merchant admin, readable in Liquid via
 * `app.metafields.clanker.project_key.value`, and writable with ZERO granted
 * scopes (verified by the §9.0 spike). The namespace is deliberately the plain
 * string "clanker", NOT "$app:clanker" — per Shopify's ownership doc the $app
 * reserved namespace isn't required because the AppInstallation owner provides
 * isolation, and $app would surface in Liquid under `app--{id}--clanker`
 * instead of `clanker`. Do not "fix" this.
 */

export const METAFIELD_NAMESPACE = "clanker";
export const METAFIELD_KEY = "project_key";
export const METAFIELD_TYPE = "single_line_text_field";

/** The block filename handle in extensions/clanker-widget/blocks/. */
export const EMBED_BLOCK_HANDLE = "clanker-support";

export function clankerApiOrigin(env?: {
	CLANKER_API_ORIGIN?: string;
}): string {
	return (
		env?.CLANKER_API_ORIGIN ||
		// Node dev path (`shopify app dev`); workerd callers pass env explicitly.
		(typeof process !== "undefined"
			? process.env.CLANKER_API_ORIGIN
			: undefined) ||
		"https://api.clankersupport.com"
	);
}

export type KeyValidation = "valid" | "invalid" | "unverified";

/**
 * The exact three-way mapping from plan §5: 200 = valid, 404 = invalid
 * ("invalid project key" is the only thing /v1/config/:key 404s for), and
 * anything else — 5xx, 429, network failure — is "couldn't verify". A non-404
 * must NEVER be reported as an invalid key.
 */
export function mapConfigStatus(status: number): KeyValidation {
	if (status === 200) return "valid";
	if (status === 404) return "invalid";
	return "unverified";
}

export async function validateProjectKey(
	key: string,
	fetchImpl: typeof fetch = fetch,
	origin: string = clankerApiOrigin(),
): Promise<KeyValidation> {
	try {
		const res = await fetchImpl(
			`${origin}/v1/config/${encodeURIComponent(key)}`,
		);
		return mapConfigStatus(res.status);
	} catch {
		// Network failure is indistinguishable from a Clanker outage: offer
		// save-anyway, never claim the key is wrong.
		return "unverified";
	}
}

export type OrderActionsResult =
	| { ok: true }
	| { ok: false; reason: "invalid_code" | "error"; message: string };

/**
 * Redeem a one-time pairing code from the Clanker dashboard: pushes this
 * shop's domain + offline Admin token to the Clanker API, which stores them as
 * the project's Shopify integration — the agent can then look up orders and
 * file returns for storefront visitors. The code is single-use and expires in
 * 10 minutes; a 404 means expired/typo'd, anything else unexpected is a
 * retryable error (the code may still be live).
 */
export async function registerOrderActions(
	input: { code: string; shopDomain: string; accessToken: string },
	fetchImpl: typeof fetch = fetch,
	origin: string = clankerApiOrigin(),
): Promise<OrderActionsResult> {
	try {
		const res = await fetchImpl(`${origin}/v1/integrations/shopify/register`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(input),
		});
		if (res.ok) return { ok: true };
		if (res.status === 404) {
			return {
				ok: false,
				reason: "invalid_code",
				message:
					"That code is invalid or expired — generate a fresh one in your Clanker dashboard (codes last 10 minutes).",
			};
		}
		const body = (await res.json().catch(() => null)) as {
			error?: string;
		} | null;
		return {
			ok: false,
			reason: "error",
			message: body?.error ?? `Clanker responded with ${res.status}.`,
		};
	} catch {
		return {
			ok: false,
			reason: "error",
			message: "Clanker's API couldn't be reached — try again in a moment.",
		};
	}
}

/** `pk_…a1b2` — enough to recognize the key, never enough to reuse it. */
export function maskKey(key: string): string {
	if (key.length <= 8) return "••••";
	const prefix = key.startsWith("pk_") ? "pk_" : key.slice(0, 3);
	return `${prefix}…${key.slice(-4)}`;
}

/**
 * Theme-editor deep link (plan §5): opens the editor with the app-embed
 * activation surfaced. `clientId` is the app's client_id/api_key (the deprecated
 * `uuid` form is not used); `template` omitted → index. Must be opened
 * TOP-LEVEL (`open(url, "_top")`) — a plain iframe navigation would trap the
 * editor inside the embedded app frame.
 */
export function themeEditorDeepLink(
	shopDomain: string,
	clientId: string,
): string {
	return `https://${shopDomain}/admin/themes/current/editor?context=apps&activateAppId=${clientId}/${EMBED_BLOCK_HANDLE}`;
}

/**
 * Minimal structural view of the authenticated Admin GraphQL client the
 * template hands us — keeps these helpers testable with a plain object.
 */
export interface AdminGraphqlClient {
	graphql(
		query: string,
		options?: { variables?: Record<string, unknown> },
	): Promise<{ json(): Promise<unknown> }>;
}

interface UserError {
	field?: string[] | null;
	message: string;
}

const CONNECTION_QUERY = `#graphql
	query ClankerConnection {
		currentAppInstallation {
			id
			metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
				value
			}
		}
	}
`;

const SET_KEY_MUTATION = `#graphql
	mutation ClankerConnect($metafields: [MetafieldsSetInput!]!) {
		metafieldsSet(metafields: $metafields) {
			metafields {
				id
				value
			}
			userErrors {
				field
				message
			}
		}
	}
`;

const DELETE_KEY_MUTATION = `#graphql
	mutation ClankerDisconnect($metafields: [MetafieldIdentifierInput!]!) {
		metafieldsDelete(metafields: $metafields) {
			deletedMetafields {
				key
			}
			userErrors {
				field
				message
			}
		}
	}
`;

export interface ClankerConnection {
	installationId: string;
	projectKey: string | null;
}

/**
 * Reads the current connection state. A null projectKey IS first-run: metafield
 * persistence across uninstall/reinstall is undocumented, so a reinstall that
 * lands here with no metafield simply asks for the key again (plan §6).
 */
export async function getConnection(
	admin: AdminGraphqlClient,
): Promise<ClankerConnection> {
	const res = await admin.graphql(CONNECTION_QUERY);
	const body = (await res.json()) as {
		data?: {
			currentAppInstallation?: {
				id: string;
				metafield?: { value: string | null } | null;
			};
		};
	};
	const installation = body.data?.currentAppInstallation;
	if (!installation?.id) {
		throw new Error("currentAppInstallation query returned no installation");
	}
	return {
		installationId: installation.id,
		projectKey: installation.metafield?.value ?? null,
	};
}

export type MetafieldWriteResult =
	{ ok: true } | { ok: false; message: string };

export async function writeProjectKey(
	admin: AdminGraphqlClient,
	installationId: string,
	projectKey: string,
): Promise<MetafieldWriteResult> {
	const res = await admin.graphql(SET_KEY_MUTATION, {
		variables: {
			metafields: [
				{
					ownerId: installationId,
					namespace: METAFIELD_NAMESPACE,
					key: METAFIELD_KEY,
					// `type` is required — we create no metafield definition.
					type: METAFIELD_TYPE,
					value: projectKey,
				},
			],
		},
	});
	const body = (await res.json()) as {
		data?: { metafieldsSet?: { userErrors?: UserError[] } };
	};
	const errors = body.data?.metafieldsSet?.userErrors ?? [];
	if (errors.length > 0) {
		return { ok: false, message: errors.map((e) => e.message).join("; ") };
	}
	return { ok: true };
}

export async function clearProjectKey(
	admin: AdminGraphqlClient,
	installationId: string,
): Promise<MetafieldWriteResult> {
	const res = await admin.graphql(DELETE_KEY_MUTATION, {
		variables: {
			metafields: [
				{
					ownerId: installationId,
					namespace: METAFIELD_NAMESPACE,
					key: METAFIELD_KEY,
				},
			],
		},
	});
	const body = (await res.json()) as {
		data?: { metafieldsDelete?: { userErrors?: UserError[] } };
	};
	const errors = body.data?.metafieldsDelete?.userErrors ?? [];
	if (errors.length > 0) {
		return { ok: false, message: errors.map((e) => e.message).join("; ") };
	}
	return { ok: true };
}
