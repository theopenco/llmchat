// Seeds realistic demo data into the LOCAL dev stack so the docs screenshots
// show a lively dashboard instead of empty states.
//
// Prerequisites (repo root):
//   1. pnpm dev     — api :8787, dashboard :3001, showcase :3003
//   2. pnpm seed    — admin@example.com + the "Acme Tools (demo)" project
// Then:
//   node apps/docs/scripts/demo-data.mjs
//
// Creates 6 conversations (escalated / visitor-resolved / rated / tagged /
// anonymous / human-takeover with a reply promoted to knowledge), 3 tags and
// 3 knowledge sources. Re-running adds turns to the same conversations
// (keyed by clientId) — for a pristine state, delete the local DB and reseed.
const API = "http://localhost:8787";
const KEY = "local-dev-key";
const WS = "dev-workspace";
const PROJECT = "dev-project";

let cookie = "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn() {
	const res = await fetch(`${API}/api/auth/sign-in/email`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "http://localhost:3001",
		},
		body: JSON.stringify({
			email: "admin@example.com",
			password: "admin@example.com",
		}),
	});
	if (!res.ok) throw new Error(`sign-in ${res.status}`);
	cookie = res.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
	console.log("signed in");
}

async function api(path, method = "GET", body) {
	const init = {
		method,
		headers: {
			cookie,
			"x-workspace-id": WS,
			origin: "http://localhost:3001",
		},
	};
	if (body) {
		init.headers["content-type"] = "application/json";
		init.body = JSON.stringify(body);
	}
	const res = await fetch(`${API}${path}`, init);
	const text = await res.text();
	if (!res.ok)
		throw new Error(
			`${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`,
		);
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

async function v1(path, body) {
	const res = await fetch(`${API}/v1/${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	const text = await res.text(); // drains the stream for /chat
	if (!res.ok)
		throw new Error(`/v1/${path} -> ${res.status}: ${text.slice(0, 200)}`);
	return text;
}

const ui = (role, text, i) => ({
	id: `${role}-${i}`,
	role,
	parts: [{ type: "text", text }],
});

async function getFeed(clientId) {
	const res = await fetch(
		`${API}/v1/messages?projectKey=${KEY}&clientId=${encodeURIComponent(clientId)}`,
	);
	return res.json();
}

async function chat(clientId, name, email, history, text) {
	const messages = [...history, ui("user", text, history.length)];
	await v1("chat", { projectKey: KEY, clientId, name, email, messages });
	await sleep(2500); // waitUntil persistence
	return getFeed(clientId);
}

function feedToHistory(feed) {
	return feed.messages
		.filter((m) => m.role === "user" || m.role === "assistant")
		.map((m, i) => ui(m.role, m.content, i));
}

const out = {};

async function main() {
	await signIn();

	// 1. Sofia — 2 turns, thumbs up, CSAT 5
	let feed = await chat(
		"docs-demo-sofia",
		"Sofia Marquez",
		"sofia@brightlayer.io",
		[],
		"Hi! Can I import our existing inventory from a CSV file?",
	);
	feed = await chat(
		"docs-demo-sofia",
		"Sofia Marquez",
		"sofia@brightlayer.io",
		feedToHistory(feed),
		"Great — is there a limit on how many items one import can have?",
	);
	const sofiaAssistant = feed.messages
		.filter((m) => m.role === "assistant")
		.at(-1);
	await v1("rating", {
		projectKey: KEY,
		clientId: "docs-demo-sofia",
		conversationId: feed.conversationId,
		messageId: sofiaAssistant.id,
		rating: "up",
	});
	await v1("csat", {
		projectKey: KEY,
		clientId: "docs-demo-sofia",
		conversationId: feed.conversationId,
		rating: 5,
	});
	out.sofia = feed.conversationId;
	console.log("sofia done", feed.conversationId);

	// 2. James — 1 turn, stays unread
	feed = await chat(
		"docs-demo-james",
		"James Chen",
		"james.chen@northwindmfg.com",
		[],
		"Does Acme Tools support barcode scanners for stock counts?",
	);
	out.james = feed.conversationId;
	console.log("james done", feed.conversationId);

	// 3. Priya — urgent bug, escalates, human takes over
	feed = await chat(
		"docs-demo-priya",
		"Priya Patel",
		"priya@apexrobotics.co",
		[],
		"Our stock levels are showing the wrong numbers since yesterday's warehouse sync. This is urgent — we're double-selling items.",
	);
	const priyaHistory = feed.messages.map((m) => ({
		role: m.role,
		content: m.content,
	}));
	await v1("escalate", {
		projectKey: KEY,
		clientId: "docs-demo-priya",
		name: "Priya Patel",
		email: "priya@apexrobotics.co",
		messages: priyaHistory,
	});
	await sleep(1500);
	out.priya = feed.conversationId;
	console.log("priya escalated", feed.conversationId);

	// 4. Marcus — resolves it himself, CSAT 4
	feed = await chat(
		"docs-demo-marcus",
		"Marcus Webb",
		"marcus@webbandsons.com",
		[],
		"How do I add a teammate to our workspace?",
	);
	await v1("resolve", { projectKey: KEY, clientId: "docs-demo-marcus" });
	await v1("csat", {
		projectKey: KEY,
		clientId: "docs-demo-marcus",
		conversationId: feed.conversationId,
		rating: 4,
	});
	out.marcus = feed.conversationId;
	console.log("marcus resolved", feed.conversationId);

	// 5. Anonymous visitor
	feed = await chat(
		"docs-demo-anon",
		undefined,
		undefined,
		[],
		"what does the growth plan cost per month?",
	);
	out.anon = feed.conversationId;
	console.log("anon done", feed.conversationId);

	// 6. Lena — admin replies, reply promoted to knowledge
	feed = await chat(
		"docs-demo-lena",
		"Lena Fischer",
		"lena@fischerparts.de",
		[],
		"Can I export a monthly stock report as a PDF?",
	);
	out.lena = feed.conversationId;
	await api(
		`/api/projects/${PROJECT}/conversations/${feed.conversationId}/reply`,
		"POST",
		{
			content:
				"Hi Lena — yes! Open Reports, pick “Monthly stock”, then use Export → PDF in the top-right. Exports include every warehouse by default; use the filter to narrow it to one location.",
		},
	);
	await sleep(1500);
	const lenaFeed = await getFeed("docs-demo-lena");
	const adminMsg = lenaFeed.messages.filter((m) => m.role === "admin").at(-1);
	if (adminMsg) {
		await api(`/api/projects/${PROJECT}/sources/promote`, "POST", {
			messageId: adminMsg.id,
		});
		console.log("lena reply promoted to knowledge");
	}

	// Admin reply on the escalated thread (human takeover)
	await api(
		`/api/projects/${PROJECT}/conversations/${out.priya}/reply`,
		"POST",
		{
			content:
				"Hi Priya, this is Omar from support — sorry about the scare. I can see the sync job from yesterday failed halfway; I've re-queued it and your counts should be correct within the hour. I'll stay on this thread until you confirm.",
		},
	);
	console.log("priya human reply sent");

	// Tags
	await api(
		`/api/projects/${PROJECT}/conversations/${out.priya}/tags`,
		"POST",
		{ name: "bug", color: "red" },
	);
	await api(
		`/api/projects/${PROJECT}/conversations/${out.sofia}/tags`,
		"POST",
		{ name: "imports", color: "indigo" },
	);
	await api(
		`/api/projects/${PROJECT}/conversations/${out.james}/tags`,
		"POST",
		{ name: "hardware", color: "amber" },
	);

	// Knowledge sources: url + text + qa
	await api(`/api/projects/${PROJECT}/sources`, "POST", {
		url: "https://clankersupport.com/llms.txt",
	});
	await api(`/api/projects/${PROJECT}/sources/text`, "POST", {
		title: "Returns & refunds policy",
		content:
			"Unused items can be returned within 30 days of delivery for a full refund. Opened consumables are non-refundable. Refunds are issued to the original payment method within 5 business days of the item arriving back at our warehouse.",
	});
	await api(`/api/projects/${PROJECT}/sources/qa`, "POST", {
		question: "Do you offer annual billing discounts?",
		answer:
			"Yes — annual plans get two months free compared to paying monthly. You can switch from monthly to annual at any time from the Billing page and the difference is prorated.",
	});
	console.log("sources created");

	console.log("ALL DONE", JSON.stringify(out));
}

main().catch((e) => {
	console.error("FAILED:", e.message);
	process.exit(1);
});
