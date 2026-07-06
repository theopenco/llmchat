// Builds the AI SDK ToolSet for a project's enabled integrations — the bridge
// between "the agent answers questions" and "the agent does things": booking
// calls through Cal.com and looking up / returning Shopify orders.
//
// Safety posture:
// - Tool results are DATA returned to the model; every failure is caught and
//   returned as { ok: false, error } so the model can apologize and recover —
//   a flaky upstream must never 500 the chat stream.
// - Order actions require the visitor's email and verify it against the order
//   server-side (see shopify-admin.ts) — an order number alone never leaks.
// - The model never carries internal ids between turns: create_return re-looks
//   the order up itself rather than trusting a model-supplied gid.

import { tool, type ToolSet } from "ai";
import { z } from "zod";

import {
	calcomConfigSchema,
	shopifyConfigSchema,
	type IntegrationKind,
} from "@llmchat/shared";

import { CalcomError, calcomCreateBooking, calcomGetSlots } from "./calcom";
import {
	ShopifyError,
	shopifyCreateReturn,
	shopifyLookupOrder,
	shopifyReturnableItems,
} from "./shopify-admin";

export interface IntegrationRowInput {
	kind: string;
	config: string;
}

export interface BuiltIntegrationTools {
	tools: ToolSet;
	/** System-prompt block describing the agent's action powers + guardrails. */
	actionsBlock: string;
}

/** Longest slot window the model may request — bounds upstream load. */
const MAX_SLOT_DAYS = 14;

/** JSON.parse that yields null (→ config skipped) instead of throwing. */
function safeJson(raw: string): unknown {
	try {
		return JSON.parse(raw || "{}");
	} catch {
		return null;
	}
}

function isoDay(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** Visitor-safe error envelope; upstream client errors keep their message. */
function toolError(
	err: unknown,
	fallback: string,
): { ok: false; error: string } {
	if (err instanceof CalcomError || err instanceof ShopifyError) {
		return { ok: false, error: err.message };
	}
	console.error("integration tool failed", err);
	return { ok: false, error: fallback };
}

/**
 * Assemble tools for the enabled integration rows. Returns null when no row
 * yields a tool (chat then streams exactly as before — zero behavior change).
 * Invalid configs are skipped, never fatal: a mangled row must not take the
 * live agent down.
 */
export function buildIntegrationTools(opts: {
	rows: IntegrationRowInput[];
	identity: { name?: string | null; email?: string | null };
	onAction?: (kind: IntegrationKind, toolName: string, ok: boolean) => void;
	now?: Date;
}): BuiltIntegrationTools | null {
	const tools: ToolSet = {};
	const notes: string[] = [];
	const report = (kind: IntegrationKind, toolName: string, ok: boolean) => {
		try {
			opts.onAction?.(kind, toolName, ok);
		} catch {
			// analytics must never break a tool round-trip
		}
	};

	for (const row of opts.rows) {
		if (row.kind === "calcom") {
			const parsed = calcomConfigSchema.safeParse(safeJson(row.config));
			if (!parsed.success) {
				console.warn("integration: skipping calcom row with invalid config");
				continue;
			}
			const cfg = parsed.data;

			tools.get_available_slots = tool({
				description:
					"List open time slots for a call with the team. Use before proposing any times — never invent availability.",
				inputSchema: z.object({
					days: z
						.number()
						.int()
						.min(1)
						.max(MAX_SLOT_DAYS)
						.default(7)
						.describe("How many days ahead to search (default 7)"),
				}),
				execute: async ({ days }) => {
					try {
						const start = opts.now ?? new Date();
						const end = new Date(
							start.getTime() + Math.min(days, MAX_SLOT_DAYS) * 86_400_000,
						);
						const slots = await calcomGetSlots(cfg, {
							start: isoDay(start),
							end: isoDay(end),
						});
						report("calcom", "get_available_slots", true);
						return {
							ok: true as const,
							timeZone: cfg.timeZone,
							slots: slots.map((s) => s.start),
						};
					} catch (err) {
						report("calcom", "get_available_slots", false);
						return toolError(err, "could not load available times");
					}
				},
			});

			tools.book_meeting = tool({
				description:
					"Book a call at one of the offered slots. Only call AFTER the visitor explicitly confirmed a specific time, and only with a slot returned by get_available_slots. Requires the visitor's email.",
				inputSchema: z.object({
					start: z
						.string()
						.max(64)
						.describe(
							"The exact slot start time as returned by get_available_slots",
						),
					email: z
						.string()
						.max(254)
						.optional()
						.describe(
							"Visitor's email — omit if it is already on file for this conversation",
						),
					name: z.string().max(120).optional(),
					notes: z
						.string()
						.max(500)
						.optional()
						.describe("Short context for the team, in the visitor's words"),
				}),
				execute: async ({ start, email, name, notes }) => {
					const attendeeEmail = email?.trim() || opts.identity.email?.trim();
					if (!attendeeEmail) {
						report("calcom", "book_meeting", false);
						return {
							ok: false as const,
							error:
								"the visitor's email is required to book — ask for it first",
						};
					}
					try {
						const booking = await calcomCreateBooking(cfg, {
							start,
							email: attendeeEmail,
							name:
								name?.trim() || opts.identity.name?.trim() || "Website visitor",
							notes,
						});
						report("calcom", "book_meeting", true);
						return { ok: true as const, booking };
					} catch (err) {
						report("calcom", "book_meeting", false);
						return toolError(err, "the booking could not be completed");
					}
				},
			});

			notes.push(
				`- Scheduling: you can check availability (get_available_slots) and book a call (book_meeting). Times are in ${cfg.timeZone}. Offer a few concrete slots, let the visitor pick, confirm the exact time and their email, then book. After booking, share the confirmed time and the join link if one is returned.`,
			);
		}

		if (row.kind === "shopify") {
			const parsed = shopifyConfigSchema.safeParse(safeJson(row.config));
			if (!parsed.success) {
				console.warn("integration: skipping shopify row with invalid config");
				continue;
			}
			const cfg = parsed.data;

			const emailFor = (provided?: string) =>
				provided?.trim() || opts.identity.email?.trim() || "";

			tools.lookup_order = tool({
				description:
					"Look up the visitor's own store order by order number + their email. Use for order status, tracking, totals, and items. Never guess an order number.",
				inputSchema: z.object({
					orderNumber: z
						.string()
						.max(32)
						.describe('The order number, e.g. "1001" or "#1001"'),
					email: z
						.string()
						.max(254)
						.optional()
						.describe(
							"Email on the order — omit if already on file for this conversation",
						),
				}),
				execute: async ({ orderNumber, email }) => {
					const addr = emailFor(email);
					if (!addr) {
						report("shopify", "lookup_order", false);
						return {
							ok: false as const,
							error:
								"the email on the order is required — ask the visitor for it",
						};
					}
					try {
						const order = await shopifyLookupOrder(cfg, {
							orderNumber,
							email: addr,
						});
						report("shopify", "lookup_order", !!order);
						if (!order) {
							return {
								ok: false as const,
								error:
									"no order found for that order number and email combination",
							};
						}
						// Strip the internal gid — the model never needs or carries it.
						const { id: _id, ...visible } = order;
						return { ok: true as const, order: visible };
					} catch (err) {
						report("shopify", "lookup_order", false);
						return toolError(err, "the order lookup failed");
					}
				},
			});

			tools.create_return = tool({
				description:
					"File a return for items on the visitor's own order (order number + email on the order). Only call AFTER the visitor explicitly confirmed they want the return filed. Optionally restrict to specific items by title.",
				inputSchema: z.object({
					orderNumber: z.string().max(32),
					email: z.string().max(254).optional(),
					itemTitles: z
						.array(z.string().max(255))
						.max(20)
						.optional()
						.describe(
							"Item titles to return — omit to return everything returnable",
						),
					reason: z
						.string()
						.max(255)
						.optional()
						.describe("The visitor's reason, in their own words"),
				}),
				execute: async ({ orderNumber, email, itemTitles, reason }) => {
					const addr = emailFor(email);
					if (!addr) {
						report("shopify", "create_return", false);
						return {
							ok: false as const,
							error:
								"the email on the order is required — ask the visitor for it",
						};
					}
					try {
						// Re-verify ownership fresh — never act on a model-carried id.
						const order = await shopifyLookupOrder(cfg, {
							orderNumber,
							email: addr,
						});
						if (!order) {
							report("shopify", "create_return", false);
							return {
								ok: false as const,
								error:
									"no order found for that order number and email combination",
							};
						}
						const returnable = await shopifyReturnableItems(cfg, order.id);
						const wanted = itemTitles?.length
							? returnable.filter((r) =>
									itemTitles.some((t) =>
										r.title.toLowerCase().includes(t.trim().toLowerCase()),
									),
								)
							: returnable;
						if (wanted.length === 0) {
							report("shopify", "create_return", false);
							return {
								ok: false as const,
								error: itemTitles?.length
									? "none of those items are returnable on this order"
									: "nothing on this order is returnable right now",
							};
						}
						const created = await shopifyCreateReturn(cfg, {
							orderId: order.id,
							items: wanted.map((w) => ({
								fulfillmentLineItemId: w.fulfillmentLineItemId,
								quantity: w.quantity,
							})),
							reasonNote: reason,
						});
						report("shopify", "create_return", true);
						return {
							ok: true as const,
							return: {
								status: created.status,
								name: created.name,
								items: wanted.map((w) => ({
									title: w.title,
									quantity: w.quantity,
								})),
							},
						};
					} catch (err) {
						report("shopify", "create_return", false);
						return toolError(err, "the return could not be filed");
					}
				},
			});

			notes.push(
				"- Store orders: you can look up the visitor's own order (lookup_order) and file a return (create_return). Both need the order number AND the email on the order — ask for whichever is missing, and never guess either. Before filing a return, confirm exactly which items and that the visitor wants it filed. Report tool errors honestly and offer to escalate to a human instead of retrying endlessly.",
			);
		}
	}

	if (Object.keys(tools).length === 0) return null;

	const actionsBlock = [
		"# Actions",
		"",
		"You can take real actions for this visitor with the tools listed below. Ground every action in tool results — never claim an action succeeded unless the tool returned ok: true, and never invent availability, order details, bookings, or returns.",
		"",
		...notes,
	].join("\n");

	return { tools, actionsBlock };
}
