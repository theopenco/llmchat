// Shopify Admin GraphQL client — plain fetch, workerd-safe (no SDK). Powers
// the agent's order actions: order lookup and customer-approved returns.
// Needs read_orders + write_returns scopes on the token.
//
// Tenant safety: every lookup requires the ORDER's email to match the email
// the visitor provided — an order number alone must never leak someone
// else's order (numbers are sequential and guessable).

import type { ShopifyConfig } from "@llmchat/shared";

const API_VERSION = "2025-01";

/** Upstream failure with a visitor-safe message (no token, no shop URLs). */
export class ShopifyError extends Error {}

// The endpoint host is ALWAYS derived from the regex-validated shopDomain — the
// untrusted, admin-writable config can no longer smuggle an arbitrary host (the
// old `apiBase` field that let a stored value exfiltrate the access token).
// `baseOverride` is a TRUSTED, server-set value (a CALCOM_/SHOPIFY_API_BASE env
// var or a unit-test argument) threaded from the worker — never from the config
// blob — so tests and self-hosters keep a mock-upstream path with no SSRF hole.
function endpoint(cfg: ShopifyConfig, baseOverride?: string): string {
	const base = (baseOverride ?? `https://${cfg.shopDomain}`).replace(/\/$/, "");
	return `${base}/admin/api/${API_VERSION}/graphql.json`;
}

async function shopifyGraphql<T>(
	cfg: ShopifyConfig,
	query: string,
	variables: Record<string, unknown>,
	baseOverride?: string,
): Promise<T> {
	// Typed off fetch itself — the workerd Response type and lib.dom's disagree.
	let res: Awaited<ReturnType<typeof fetch>>;
	try {
		res = await fetch(endpoint(cfg, baseOverride), {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-shopify-access-token": cfg.accessToken,
			},
			body: JSON.stringify({ query, variables }),
		});
	} catch {
		throw new ShopifyError("the store could not be reached");
	}
	const body = (await res.json().catch(() => null)) as {
		data?: T;
		errors?: { message?: string }[];
	} | null;
	if (!res.ok || !body?.data) {
		const detail =
			body?.errors?.[0]?.message ?? `store request failed (${res.status})`;
		throw new ShopifyError(detail);
	}
	return body.data;
}

export interface ShopifyOrderSummary {
	/** GraphQL gid — internal handle for follow-up calls, never shown. */
	id: string;
	/** Human order name, e.g. "#1001". */
	name: string;
	createdAt: string;
	financialStatus: string;
	fulfillmentStatus: string;
	total: string;
	currency: string;
	lineItems: { title: string; quantity: number }[];
	tracking: { number?: string; url?: string; company?: string }[];
}

const ORDER_QUERY = /* GraphQL */ `
	query LookupOrder($q: String!) {
		orders(first: 1, query: $q) {
			nodes {
				id
				name
				email
				createdAt
				displayFinancialStatus
				displayFulfillmentStatus
				totalPriceSet {
					shopMoney {
						amount
						currencyCode
					}
				}
				lineItems(first: 20) {
					nodes {
						title
						quantity
					}
				}
				fulfillments(first: 5) {
					trackingInfo(first: 5) {
						number
						url
						company
					}
				}
			}
		}
	}
`;

/** Normalize an order name for the query: visitors type "1001" or "#1001". */
function normalizeOrderNumber(orderNumber: string): string {
	return orderNumber.trim().replace(/^#/, "");
}

/**
 * Look up ONE order by order number, verified against the visitor's email.
 * Returns null when there is no such order OR the email doesn't match — the
 * two cases are deliberately indistinguishable to the caller.
 */
export async function shopifyLookupOrder(
	cfg: ShopifyConfig,
	opts: { orderNumber: string; email: string },
	baseOverride?: string,
): Promise<ShopifyOrderSummary | null> {
	const num = normalizeOrderNumber(opts.orderNumber);
	if (!num) return null;
	// The email is part of the SERVER-side query, then re-checked on the result:
	// belt and braces against query-syntax surprises.
	const q = `name:#${num} AND email:${opts.email.trim().toLowerCase()}`;
	const data = await shopifyGraphql<{
		orders: {
			nodes: {
				id: string;
				name: string;
				email: string | null;
				createdAt: string;
				displayFinancialStatus: string | null;
				displayFulfillmentStatus: string | null;
				totalPriceSet: {
					shopMoney: { amount: string; currencyCode: string };
				} | null;
				lineItems: { nodes: { title: string; quantity: number }[] };
				fulfillments: {
					trackingInfo: {
						number: string | null;
						url: string | null;
						company: string | null;
					}[];
				}[];
			}[];
		};
	}>(cfg, ORDER_QUERY, { q }, baseOverride);

	const order = data.orders.nodes[0];
	if (!order) return null;
	if (
		(order.email ?? "").trim().toLowerCase() !== opts.email.trim().toLowerCase()
	) {
		return null;
	}
	return {
		id: order.id,
		name: order.name,
		createdAt: order.createdAt,
		financialStatus: order.displayFinancialStatus ?? "unknown",
		fulfillmentStatus: order.displayFulfillmentStatus ?? "unknown",
		total: order.totalPriceSet?.shopMoney.amount ?? "",
		currency: order.totalPriceSet?.shopMoney.currencyCode ?? "",
		lineItems: order.lineItems.nodes.map((li) => ({
			title: li.title,
			quantity: li.quantity,
		})),
		tracking: order.fulfillments.flatMap((f) =>
			f.trackingInfo.map((t) => ({
				number: t.number ?? undefined,
				url: t.url ?? undefined,
				company: t.company ?? undefined,
			})),
		),
	};
}

export interface ReturnableItem {
	fulfillmentLineItemId: string;
	title: string;
	quantity: number;
}

const RETURNABLE_QUERY = /* GraphQL */ `
	query ReturnableItems($orderId: ID!) {
		returnableFulfillments(orderId: $orderId, first: 10) {
			edges {
				node {
					returnableFulfillmentLineItems(first: 50) {
						edges {
							node {
								quantity
								fulfillmentLineItem {
									id
									lineItem {
										title
									}
								}
							}
						}
					}
				}
			}
		}
	}
`;

/** Everything still returnable on an order (shipped + within policy). */
export async function shopifyReturnableItems(
	cfg: ShopifyConfig,
	orderId: string,
	baseOverride?: string,
): Promise<ReturnableItem[]> {
	const data = await shopifyGraphql<{
		returnableFulfillments: {
			edges: {
				node: {
					returnableFulfillmentLineItems: {
						edges: {
							node: {
								quantity: number;
								fulfillmentLineItem: {
									id: string;
									lineItem: { title: string };
								};
							};
						}[];
					};
				};
			}[];
		};
	}>(cfg, RETURNABLE_QUERY, { orderId }, baseOverride);

	return data.returnableFulfillments.edges.flatMap((f) =>
		f.node.returnableFulfillmentLineItems.edges.map((e) => ({
			fulfillmentLineItemId: e.node.fulfillmentLineItem.id,
			title: e.node.fulfillmentLineItem.lineItem.title,
			quantity: e.node.quantity,
		})),
	);
}

const RETURN_CREATE_MUTATION = /* GraphQL */ `
	mutation CreateReturn($returnInput: ReturnInput!) {
		returnCreate(returnInput: $returnInput) {
			return {
				id
				status
				name
			}
			userErrors {
				field
				message
			}
		}
	}
`;

export interface CreatedReturn {
	id: string;
	status: string;
	/** Human return name, e.g. "#1001-R1" — may be absent on older API versions. */
	name?: string;
}

/**
 * File a return (state OPEN — Shopify treats it as request-already-approved)
 * for specific fulfillment line items. `reasonNote` is the visitor's own words.
 */
export async function shopifyCreateReturn(
	cfg: ShopifyConfig,
	opts: {
		orderId: string;
		items: { fulfillmentLineItemId: string; quantity: number }[];
		reasonNote?: string;
	},
	baseOverride?: string,
): Promise<CreatedReturn> {
	const data = await shopifyGraphql<{
		returnCreate: {
			return: { id: string; status: string; name?: string | null } | null;
			userErrors: { field: string[] | null; message: string }[];
		};
	}>(
		cfg,
		RETURN_CREATE_MUTATION,
		{
			returnInput: {
				orderId: opts.orderId,
				returnLineItems: opts.items.map((i) => ({
					fulfillmentLineItemId: i.fulfillmentLineItemId,
					quantity: i.quantity,
					returnReason: "OTHER",
					...(opts.reasonNote
						? { returnReasonNote: opts.reasonNote.slice(0, 255) }
						: {}),
				})),
			},
		},
		baseOverride,
	);

	const err = data.returnCreate.userErrors[0];
	if (err || !data.returnCreate.return) {
		throw new ShopifyError(err?.message ?? "the return could not be created");
	}
	return {
		id: data.returnCreate.return.id,
		status: data.returnCreate.return.status,
		name: data.returnCreate.return.name ?? undefined,
	};
}
