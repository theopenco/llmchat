// End-to-end drive of the integrations through the LIVE stack:
// widget-protocol /v1/chat requests against the running workerd api, which
// runs the real AI SDK tool loop against the mock model + mock Cal.com/Shopify.
// Asserts the full loop: slots offered → booking confirmed with the Zoom link,
// order status with tracking → return filed.
const API = "http://localhost:8787";
const KEY = "local-dev-key";
const CLIENT = `e2e-${Date.now()}`;

let failures = 0;
const check = (label, cond, detail = "") => {
	console.log(`${cond ? "✓" : "✗"} ${label}${cond ? "" : ` — ${detail}`}`);
	if (!cond) failures += 1;
};

const history = [];
let msgId = 0;

async function say(text) {
	history.push({
		id: `u${++msgId}`,
		role: "user",
		parts: [{ type: "text", text }],
	});
	const res = await fetch(`${API}/v1/chat`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			projectKey: KEY,
			clientId: CLIENT,
			name: "Mia",
			email: "mia@example.com",
			messages: history,
		}),
	});
	if (!res.ok) throw new Error(`/v1/chat ${res.status}: ${await res.text()}`);
	// Parse the UI message stream (SSE data lines) and collect text deltas.
	const raw = await res.text();
	let reply = "";
	for (const line of raw.split("\n")) {
		if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
		try {
			const evt = JSON.parse(line.slice(6));
			if (evt.type === "text-delta") reply += evt.delta ?? evt.textDelta ?? "";
		} catch {}
	}
	history.push({
		id: `a${msgId}`,
		role: "assistant",
		parts: [{ type: "text", text: reply }],
	});
	console.log(
		`\n> ${text}\n${reply
			.split("\n")
			.map((l) => "  " + l)
			.join("\n")}`,
	);
	return reply;
}

// ── Scheduling flow ──────────────────────────────────────────────────────
const slots = await say("Hi! Can I book a call with your team this week?");
check(
	"bot offers real slots from Cal.com",
	/UTC/.test(slots) && /09:00|10:30|15:00/.test(slots),
	slots.slice(0, 120),
);

const booked = await say("The 10:30 one works, book it please!");
check(
	"booking confirmed",
	/booked|all set/i.test(booked),
	booked.slice(0, 120),
);
check(
	"Zoom join link surfaced",
	booked.includes("zoom.us/j/9912345678"),
	booked.slice(0, 160),
);

// ── Order flow ───────────────────────────────────────────────────────────
const status = await say("Also, where is my order #1001?");
check(
	"order found with items",
	/#1001/.test(status) && /Wrench/i.test(status),
	status.slice(0, 120),
);
check(
	"tracking number surfaced",
	/UPS-1Z999AA10123456784/.test(status),
	status.slice(0, 160),
);

const ret = await say(
	"The wrench is too small — I want to return it from order #1001.",
);
check(
	"return filed with the return name",
	/#1001-R1/.test(ret),
	ret.slice(0, 160),
);
check(
	"return scoped to the wrench only",
	/Wrench/i.test(ret) && !/Socket Set/.test(ret),
	ret.slice(0, 160),
);

// ── Persistence: the whole exchange landed in the conversation ──────────
const msgs = await (
	await fetch(`${API}/v1/messages?projectKey=${KEY}&clientId=${CLIENT}`)
).json();
const stored = msgs.messages ?? [];
check(
	"assistant replies persisted for the inbox",
	stored.filter((m) => m.role === "assistant").length >= 4,
	`stored=${stored.length}`,
);
check(
	"persisted booking text matches the stream",
	stored.some((m) => m.content?.includes("zoom.us/j/9912345678")),
);

console.log(
	failures === 0 ? "\nE2E PASS (9 checks)" : `\nE2E FAIL (${failures})`,
);
process.exit(failures === 0 ? 0 : 1);
