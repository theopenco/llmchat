// Deterministic upstream for the integrations demo/e2e:
//  - /v1/chat/completions  — OpenAI-compatible SSE "model" with a scripted
//    tool-calling policy (no real LLM key on this machine). The REAL AI SDK
//    tool loop, api clients, persistence, widget and dashboard all run live.
//  - /v2/slots, /v2/bookings — Cal.com API v2 shapes.
//  - /admin/api/2025-01/graphql.json — Shopify Admin GraphQL shapes.
import http from "node:http";

const PORT = 9099;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ── Cal.com fixtures ─────────────────────────────────────────────────── */
const day = (offset) => {
	const d = new Date(Date.now() + offset * 86_400_000);
	return d.toISOString().slice(0, 10);
};
const SLOTS = {
	[day(1)]: [
		{ start: `${day(1)}T09:00:00.000Z` },
		{ start: `${day(1)}T10:30:00.000Z` },
		{ start: `${day(1)}T15:00:00.000Z` },
	],
	[day(2)]: [{ start: `${day(2)}T11:00:00.000Z` }],
};
const ZOOM_LINK = "https://zoom.us/j/9912345678";

/* ── Shopify fixtures ─────────────────────────────────────────────────── */
const ORDER = {
	id: "gid://shopify/Order/7001",
	name: "#1001",
	email: "mia@example.com",
	createdAt: "2026-06-28T10:00:00Z",
	displayFinancialStatus: "PAID",
	displayFulfillmentStatus: "FULFILLED",
	totalPriceSet: { shopMoney: { amount: "64.00", currencyCode: "USD" } },
	lineItems: {
		nodes: [
			{ title: "Adjustable Wrench", quantity: 1 },
			{ title: "Socket Set", quantity: 1 },
		],
	},
	fulfillments: [
		{
			trackingInfo: [
				{
					number: "UPS-1Z999AA10123456784",
					url: "https://tracking.example/1Z999",
					company: "UPS",
				},
			],
		},
	],
};

/* ── Scripted model policy ────────────────────────────────────────────── */
const text = (m) =>
	typeof m.content === "string"
		? m.content
		: (m.content ?? [])
				.map((p) => (typeof p === "string" ? p : (p.text ?? "")))
				.join(" ");

function toolNameFor(messages, toolMsg) {
	for (const m of messages) {
		for (const tc of m.tool_calls ?? []) {
			if (tc.id === toolMsg.tool_call_id) return tc.function?.name;
		}
	}
	return null;
}

/** Decide the next assistant move from the conversation so far. */
function decide(messages) {
	const last = messages[messages.length - 1];

	// A tool result just came back — narrate it.
	if (last?.role === "tool") {
		const name = toolNameFor(messages, last);
		let out = {};
		try {
			out = JSON.parse(text(last));
		} catch {}
		if (out.ok === false) {
			return {
				say: `I hit a snag: ${out.error}. Want me to loop in a teammate instead?`,
			};
		}
		if (name === "get_available_slots") {
			const slots = out.slots ?? [];
			// The visitor may have ALREADY picked a time in their message (tool
			// results don't round-trip across turns in the client history) — a
			// real model would chain straight into the booking; mirror that.
			const lastUser = [...messages].reverse().find((m) => m.role === "user");
			const q = text(lastUser ?? {}).toLowerCase();
			const hhmm = q.match(/(\d{1,2}):(\d{2})/);
			let pick = null;
			if (hhmm) {
				const t = `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;
				pick = slots.find((s) => s.includes(`T${t}`));
			} else if (/first|earliest/.test(q)) {
				pick = slots[0];
			}
			if (pick && /book|works|take|yes|that|please/.test(q)) {
				return { call: { name: "book_meeting", args: { start: pick } } };
			}
			const nice = slots
				.slice(0, 3)
				.map((s) => `• ${s.slice(0, 10)} at ${s.slice(11, 16)} UTC`)
				.join("\n");
			return {
				say: `Happy to set that up! Here are the next open times:\n${nice}\n\nWhich one works for you?`,
			};
		}
		if (name === "book_meeting") {
			const b = out.booking ?? {};
			return {
				say: `You're all set! ✅ Your call is booked for ${String(b.start).slice(0, 10)} at ${String(b.start).slice(11, 16)} UTC.\n\nJoin link: ${b.location ?? "(sent by email)"}\n\nA calendar invite is on its way to your inbox.`,
			};
		}
		if (name === "lookup_order") {
			const o = out.order ?? {};
			const items = (o.lineItems ?? [])
				.map((li) => `${li.quantity}× ${li.title}`)
				.join(", ");
			const trk = o.tracking?.[0];
			return {
				say: `Found it — order ${o.name} (${items}).\n\n• Payment: ${o.financialStatus}\n• Fulfillment: ${o.fulfillmentStatus}\n• Tracking: ${trk ? `${trk.company} ${trk.number}` : "not available yet"}\n\nAnything else I can do with this order?`,
			};
		}
		if (name === "create_return") {
			const r = out.return ?? {};
			const items = (r.items ?? [])
				.map((i) => `${i.quantity}× ${i.title}`)
				.join(", ");
			return {
				say: `Done — I've filed return ${r.name ?? ""} for ${items}. You'll get a confirmation email with the return label shortly. Anything else?`,
			};
		}
		return { say: "All done! Anything else I can help with?" };
	}

	// A fresh user turn — decide whether to act.
	const lastUser = [...messages].reverse().find((m) => m.role === "user");
	const q = text(lastUser ?? {}).toLowerCase();

	// Picking a time after slots were offered → book it.
	const priorSlots = messages
		.filter((m) => m.role === "tool")
		.map((m) => {
			try {
				return JSON.parse(text(m));
			} catch {
				return {};
			}
		})
		.filter((o) => Array.isArray(o.slots))
		.flatMap((o) => o.slots);
	if (priorSlots.length) {
		const hhmm = q.match(/(\d{1,2}):(\d{2})/);
		let pick = null;
		if (hhmm) {
			const t = `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;
			pick = priorSlots.find((s) => s.includes(`T${t}`));
		} else if (/first|earliest|9\b/.test(q)) {
			pick = priorSlots[0];
		}
		if (pick && /book|works|take|yes|that/.test(q + (hhmm ? "y" : ""))) {
			return {
				call: { name: "book_meeting", args: { start: pick } },
			};
		}
	}

	if (/book|schedule|call|demo|meeting|talk to (sales|someone)/.test(q)) {
		return { call: { name: "get_available_slots", args: { days: 5 } } };
	}

	const orderMatch = q.match(/#?(\d{3,})/);
	if (/return|send (it )?back|refund/.test(q) && orderMatch) {
		const itemTitles = /wrench/.test(q) ? ["wrench"] : undefined;
		return {
			call: {
				name: "create_return",
				args: {
					orderNumber: orderMatch[1],
					...(itemTitles ? { itemTitles } : {}),
					reason: "Requested via chat",
				},
			},
		};
	}
	if (/order|package|tracking|where/.test(q) && orderMatch) {
		return {
			call: { name: "lookup_order", args: { orderNumber: orderMatch[1] } },
		};
	}

	return {
		say: "I can help with questions about Acme Tools, check on an order (just give me the order number), or set up a call with the team. What do you need?",
	};
}

/* ── SSE plumbing (OpenAI chat.completion.chunk) ──────────────────────── */
function sse(res, obj) {
	res.write(`data: ${JSON.stringify(obj)}\n\n`);
}
function chunk(delta, finish = null) {
	return {
		id: "chatcmpl-demo",
		object: "chat.completion.chunk",
		created: Math.floor(Date.now() / 1000),
		model: "demo-scripted",
		choices: [{ index: 0, delta, finish_reason: finish }],
	};
}

async function handleChat(req, res, body) {
	const { messages = [] } = JSON.parse(body);
	const move = decide(messages);
	res.writeHead(200, {
		"content-type": "text/event-stream",
		"cache-control": "no-cache",
		connection: "keep-alive",
	});
	sse(res, chunk({ role: "assistant" }));
	if (move.call) {
		log("model → tool_call", move.call.name, JSON.stringify(move.call.args));
		sse(
			res,
			chunk({
				tool_calls: [
					{
						index: 0,
						id: `call_${Math.random().toString(36).slice(2, 10)}`,
						type: "function",
						function: {
							name: move.call.name,
							arguments: JSON.stringify(move.call.args),
						},
					},
				],
			}),
		);
		sse(res, { ...chunk({}, "tool_calls"), usage: usage() });
	} else {
		log("model → text", move.say.slice(0, 60).replaceAll("\n", " "));
		// Stream word-by-word so the widget's streaming render shows.
		for (const word of move.say.split(/(?<= )/)) {
			sse(res, chunk({ content: word }));
			await new Promise((r) => setTimeout(r, 12));
		}
		sse(res, { ...chunk({}, "stop"), usage: usage() });
	}
	res.write("data: [DONE]\n\n");
	res.end();
}
const usage = () => ({
	prompt_tokens: 120,
	completion_tokens: 40,
	total_tokens: 160,
});

/* ── Shopify GraphQL ──────────────────────────────────────────────────── */
function handleShopify(res, body) {
	const { query = "", variables = {} } = JSON.parse(body);
	if (query.includes("LookupOrder")) {
		const q = String(variables.q ?? "");
		log("shopify ← LookupOrder", q);
		const match = q.includes("#1001") && q.includes(ORDER.email) ? [ORDER] : [];
		return json(res, { data: { orders: { nodes: match } } });
	}
	if (query.includes("ReturnableItems")) {
		log("shopify ← ReturnableItems", variables.orderId);
		return json(res, {
			data: {
				returnableFulfillments: {
					edges: [
						{
							node: {
								returnableFulfillmentLineItems: {
									edges: [
										{
											node: {
												quantity: 1,
												fulfillmentLineItem: {
													id: "gid://shopify/FulfillmentLineItem/111",
													lineItem: { title: "Adjustable Wrench" },
												},
											},
										},
										{
											node: {
												quantity: 1,
												fulfillmentLineItem: {
													id: "gid://shopify/FulfillmentLineItem/112",
													lineItem: { title: "Socket Set" },
												},
											},
										},
									],
								},
							},
						},
					],
				},
			},
		});
	}
	if (query.includes("CreateReturn")) {
		log(
			"shopify ← CreateReturn",
			JSON.stringify(variables.returnInput?.returnLineItems),
		);
		return json(res, {
			data: {
				returnCreate: {
					return: {
						id: "gid://shopify/Return/501",
						status: "OPEN",
						name: "#1001-R1",
					},
					userErrors: [],
				},
			},
		});
	}
	return json(res, { errors: [{ message: "unknown query" }] }, 400);
}

const json = (res, obj, status = 200) => {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(JSON.stringify(obj));
};

/* ── Server ───────────────────────────────────────────────────────────── */
http
	.createServer((req, res) => {
		let body = "";
		req.on("data", (c) => (body += c));
		req.on("end", () => {
			const url = new URL(req.url, "http://localhost");
			try {
				if (url.pathname.endsWith("/chat/completions")) {
					return void handleChat(req, res, body);
				}
				if (url.pathname === "/v2/slots") {
					log("calcom ← slots", url.search);
					return json(res, { status: "success", data: SLOTS });
				}
				if (url.pathname === "/v2/bookings") {
					const b = JSON.parse(body);
					log("calcom ← booking", b.start, b.attendee?.email);
					return json(res, {
						status: "success",
						data: {
							uid: "bk_demo_1",
							status: "accepted",
							start: b.start,
							end: new Date(
								new Date(b.start).getTime() + 30 * 60_000,
							).toISOString(),
							location: ZOOM_LINK,
						},
					});
				}
				if (url.pathname === "/admin/api/2025-01/graphql.json") {
					return handleShopify(res, body);
				}
				json(res, { error: `no route for ${url.pathname}` }, 404);
			} catch (err) {
				log("ERROR", err.message);
				json(res, { error: err.message }, 500);
			}
		});
	})
	.listen(PORT, "127.0.0.1", () =>
		log(`mock upstream on http://127.0.0.1:${PORT}`),
	);
