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
// - book_meeting's attendee is BOUND to the conversation's on-file identity
//   email (never a model-chosen address) so the agent can't be steered into
//   sending a team calendar invite to an arbitrary third party.
// - Side-effecting actions (book_meeting, create_return) run through injectable
//   `guards` (per-project action rate/quota + create_return idempotency) and
//   every call is surfaced via `onAction` for the durable operator audit log.
// - Upstream base URLs come ONLY from trusted, server-set `baseOverrides`
//   (env/test), never from the untrusted stored config — closing the SSRF /
//   credential-exfiltration vector the old `apiBase` config field opened.

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

/** A single agent action, handed to the caller for the durable audit log +
 * analytics. Params carry the visitor-supplied inputs (order number, email,
 * slot, item titles) — NEVER credentials. */
export interface IntegrationActionRecord {
	kind: IntegrationKind;
	tool: string;
	ok: boolean;
	/** Short human summary for the operator audit trail. */
	detail?: string;
	/** Sanitized tool inputs — never secrets. */
	params?: Record<string, unknown>;
}

/** Server-side guards the caller wires to STATE. Optional — when absent the
 * tools run unguarded (unit tests / self-host without a state binding). */
export interface IntegrationGuards {
	/** Return false to BLOCK a side-effecting action (per-project action
	 * rate + daily quota). Checked before book_meeting / create_return fire. */
	actionLimit?: (kind: IntegrationKind, tool: string) => Promise<boolean>;
	/** Return false when this exact action was JUST performed (idempotency);
	 * true reserves the key. Guards create_return against double-filing. */
	once?: (key: string) => Promise<boolean>;
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
	onAction?: (record: IntegrationActionRecord) => void;
	guards?: IntegrationGuards;
	/** TRUSTED per-kind base-URL overrides (env / unit test only — NEVER the
	 * untrusted stored config). Absent ⇒ the pinned upstream host is used. */
	baseOverrides?: { calcom?: string; shopify?: string };
	/** Scopes the create_return idempotency key to this conversation. */
	conversationId?: string;
	now?: Date;
}): BuiltIntegrationTools | null {
	const tools: ToolSet = {};
	const notes: string[] = [];
	const convScope = opts.conversationId ?? "nc";
	const report = (record: IntegrationActionRecord) => {
		try {
			opts.onAction?.(record);
		} catch {
			// analytics / audit must never break a tool round-trip
		}
	};
	// Rate/quota gate for a side-effecting action. Absent guard ⇒ allowed;
	// a guard FAULT closes the gate (never silently opens a write path).
	const allowAction = async (kind: IntegrationKind, toolName: string) => {
		if (!opts.guards?.actionLimit) return true;
		try {
			return await opts.guards.actionLimit(kind, toolName);
		} catch {
			return false;
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
			const calBase = opts.baseOverrides?.calcom;

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
						const slots = await calcomGetSlots(
							cfg,
							{ start: isoDay(start), end: isoDay(end) },
							calBase,
						);
						report({
							kind: "calcom",
							tool: "get_available_slots",
							ok: true,
							params: { days },
							detail: `listed ${slots.length} open slot(s)`,
						});
						return {
							ok: true as const,
							timeZone: cfg.timeZone,
							slots: slots.map((s) => s.start),
						};
					} catch (err) {
						report({
							kind: "calcom",
							tool: "get_available_slots",
							ok: false,
							params: { days },
							detail: "availability lookup failed",
						});
						return toolError(err, "could not load available times");
					}
				},
			});

			tools.book_meeting = tool({
				description:
					"Book a call at one of the offered slots. Only call AFTER the visitor explicitly confirmed a specific time, and only with a slot returned by get_available_slots. The call is booked for the email already on file for this conversation — you cannot book on behalf of a different address.",
				inputSchema: z.object({
					start: z
						.string()
						.max(64)
						.describe(
							"The exact slot start time as returned by get_available_slots",
						),
					name: z.string().max(120).optional(),
					notes: z
						.string()
						.max(500)
						.optional()
						.describe("Short context for the team, in the visitor's words"),
				}),
				execute: async ({ start, name, notes: meetingNotes }) => {
					// SECURITY: the attendee is ALWAYS the conversation's on-file email.
					// A model-supplied address is deliberately not accepted, so the agent
					// cannot be steered into inviting an arbitrary third party ("book for
					// victim@x.com"). Mirrors the Shopify tools' server-side email binding.
					const attendeeEmail = opts.identity.email?.trim();
					if (!attendeeEmail) {
						report({
							kind: "calcom",
							tool: "book_meeting",
							ok: false,
							params: { start },
							detail: "refused: no email on file",
						});
						return {
							ok: false as const,
							error:
								"I need the visitor's email on file before booking — ask them to share it so it's saved to this conversation, then book.",
						};
					}
					if (!(await allowAction("calcom", "book_meeting"))) {
						report({
							kind: "calcom",
							tool: "book_meeting",
							ok: false,
							params: { start, email: attendeeEmail },
							detail: "blocked: action rate/quota limit",
						});
						return {
							ok: false as const,
							error:
								"We've reached the booking limit for now — please try again later or ask to speak with a human.",
						};
					}
					try {
						const booking = await calcomCreateBooking(
							cfg,
							{
								start,
								email: attendeeEmail,
								name:
									name?.trim() ||
									opts.identity.name?.trim() ||
									"Website visitor",
								notes: meetingNotes,
							},
							calBase,
						);
						report({
							kind: "calcom",
							tool: "book_meeting",
							ok: true,
							params: { start, email: attendeeEmail },
							detail: `booked ${booking.start} for ${attendeeEmail}${booking.uid ? ` (${booking.uid})` : ""}`,
						});
						return { ok: true as const, booking };
					} catch (err) {
						report({
							kind: "calcom",
							tool: "book_meeting",
							ok: false,
							params: { start, email: attendeeEmail },
							detail: "booking failed upstream",
						});
						return toolError(err, "the booking could not be completed");
					}
				},
			});

			notes.push(
				`- Scheduling: you can check availability (get_available_slots) and book a call (book_meeting). Times are in ${cfg.timeZone}. The booking uses the email already on file for this conversation — if none is on file, ask the visitor to share their email first. Offer a few concrete slots, let the visitor pick, confirm the exact time, then book. After booking, share the confirmed time and the join link if one is returned.`,
			);
		}

		if (row.kind === "shopify") {
			const parsed = shopifyConfigSchema.safeParse(safeJson(row.config));
			if (!parsed.success) {
				console.warn("integration: skipping shopify row with invalid config");
				continue;
			}
			const cfg = parsed.data;
			const shopBase = opts.baseOverrides?.shopify;

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
						report({
							kind: "shopify",
							tool: "lookup_order",
							ok: false,
							params: { orderNumber },
							detail: "refused: no email provided",
						});
						return {
							ok: false as const,
							error:
								"the email on the order is required — ask the visitor for it",
						};
					}
					try {
						const order = await shopifyLookupOrder(
							cfg,
							{ orderNumber, email: addr },
							shopBase,
						);
						report({
							kind: "shopify",
							tool: "lookup_order",
							ok: !!order,
							params: { orderNumber, email: addr },
							detail: order
								? `looked up order ${order.name}`
								: `no order for ${orderNumber} + that email`,
						});
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
						report({
							kind: "shopify",
							tool: "lookup_order",
							ok: false,
							params: { orderNumber, email: addr },
							detail: "order lookup failed upstream",
						});
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
						report({
							kind: "shopify",
							tool: "create_return",
							ok: false,
							params: { orderNumber },
							detail: "refused: no email provided",
						});
						return {
							ok: false as const,
							error:
								"the email on the order is required — ask the visitor for it",
						};
					}
					if (!(await allowAction("shopify", "create_return"))) {
						report({
							kind: "shopify",
							tool: "create_return",
							ok: false,
							params: { orderNumber, email: addr },
							detail: "blocked: action rate/quota limit",
						});
						return {
							ok: false as const,
							error:
								"We've reached the returns limit for now — please try again later or ask to speak with a human.",
						};
					}
					try {
						// Re-verify ownership fresh — never act on a model-carried id.
						const order = await shopifyLookupOrder(
							cfg,
							{ orderNumber, email: addr },
							shopBase,
						);
						if (!order) {
							report({
								kind: "shopify",
								tool: "create_return",
								ok: false,
								params: { orderNumber, email: addr },
								detail: "refused: order/email mismatch",
							});
							return {
								ok: false as const,
								error:
									"no order found for that order number and email combination",
							};
						}
						const returnable = await shopifyReturnableItems(
							cfg,
							order.id,
							shopBase,
						);
						const wanted = itemTitles?.length
							? returnable.filter((r) =>
									itemTitles.some((t) =>
										r.title.toLowerCase().includes(t.trim().toLowerCase()),
									),
								)
							: returnable;
						if (wanted.length === 0) {
							report({
								kind: "shopify",
								tool: "create_return",
								ok: false,
								params: { orderNumber, email: addr, itemTitles },
								detail: "nothing returnable",
							});
							return {
								ok: false as const,
								error: itemTitles?.length
									? "none of those items are returnable on this order"
									: "nothing on this order is returnable right now",
							};
						}
						// Idempotency: a committed-but-lost response or a double-fire must
						// not file the return twice. Keyed on (conversation, order, items)
						// and reserved right before the state-changing mutation.
						const dedupeKey = `return:${convScope}:${order.name}:${wanted
							.map((w) => w.fulfillmentLineItemId)
							// eslint-disable-next-line unicorn/no-array-sort -- fresh mapped array; toSorted() is not in the api's TS lib target
							.sort()
							.join(",")}`;
						if (opts.guards?.once) {
							let fresh = false;
							try {
								fresh = await opts.guards.once(dedupeKey);
							} catch {
								fresh = false; // fail safe: treat as a possible duplicate
							}
							if (!fresh) {
								report({
									kind: "shopify",
									tool: "create_return",
									ok: false,
									params: { orderNumber, email: addr, itemTitles },
									detail: "blocked: duplicate return (idempotency)",
								});
								return {
									ok: false as const,
									error:
										"That return was just filed for this order — you'll get a confirmation by email. I won't file it a second time.",
								};
							}
						}
						const created = await shopifyCreateReturn(
							cfg,
							{
								orderId: order.id,
								items: wanted.map((w) => ({
									fulfillmentLineItemId: w.fulfillmentLineItemId,
									quantity: w.quantity,
								})),
								reasonNote: reason,
							},
							shopBase,
						);
						report({
							kind: "shopify",
							tool: "create_return",
							ok: true,
							params: {
								orderNumber,
								email: addr,
								itemTitles: wanted.map((w) => w.title),
							},
							detail: `filed return ${created.name ?? created.status} on order ${order.name} for ${addr}`,
						});
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
						report({
							kind: "shopify",
							tool: "create_return",
							ok: false,
							params: { orderNumber, email: addr, itemTitles },
							detail: "return failed upstream",
						});
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
