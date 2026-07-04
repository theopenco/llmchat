// Captures the light+dark screenshots embedded in the docs (public/learn/).
//
// Prerequisites (repo root):
//   1. pnpm dev                                        — full local stack
//   2. pnpm seed                                       — admin + demo project
//   3. node apps/docs/scripts/demo-data.mjs            — inbox fixtures
//   4. pnpm --filter @llmchat/docs exec playwright install chromium   (once)
// Then:
//   node apps/docs/scripts/capture-screenshots.mjs [shot1,shot2]
//
// Writes 1440×900@2x PNGs to apps/docs/public/learn/<name>-{light,dark}.png.
// Conversation deep-links are discovered live via the API (by visitor email),
// so this works against any freshly seeded database.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const DASH = "http://localhost:3001";
const SHOWCASE = "http://localhost:3003";
const APIURL = "http://localhost:8787";
const WS = "dev-workspace";
const P = "dev-project";
const OUT = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"public",
	"learn",
);

mkdirSync(OUT, { recursive: true });

const settle = (page, ms = 1200) => page.waitForTimeout(ms);

async function signIn() {
	const res = await fetch(`${APIURL}/api/auth/sign-in/email`, {
		method: "POST",
		headers: { "content-type": "application/json", origin: DASH },
		body: JSON.stringify({
			email: "admin@example.com",
			password: "admin@example.com",
		}),
	});
	if (!res.ok) throw new Error(`sign-in ${res.status}`);
	const raw = res.headers
		.getSetCookie()
		.find((c) => c.includes("session_token"));
	const [pair] = raw.split(";");
	const idx = pair.indexOf("=");
	return {
		name: pair.slice(0, idx),
		value: pair.slice(idx + 1),
		domain: "localhost",
		path: "/",
		httpOnly: true,
		secure: false,
		sameSite: "Lax",
	};
}

// Conversation ids move on every reseed — look them up by visitor email.
async function lookupIds(cookie) {
	const res = await fetch(
		`${APIURL}/api/projects/${P}/conversations?status=all&limit=100`,
		{
			headers: {
				cookie: `${cookie.name}=${cookie.value}`,
				"x-workspace-id": WS,
				origin: DASH,
			},
		},
	);
	if (!res.ok) throw new Error(`conversations ${res.status}`);
	const { conversations } = await res.json();
	const byEmail = (email) =>
		conversations.find((c) => c.email === email)?.id ?? null;
	return {
		sofia: byEmail("sofia@brightlayer.io"),
		priya: byEmail("priya@apexrobotics.co"),
		marcus: byEmail("marcus@webbandsons.com"),
		lena: byEmail("lena@fischerparts.de"),
	};
}

async function waitInbox(page) {
	await page.getByText("Sofia Marquez").first().waitFor({ timeout: 30_000 });
	await settle(page);
}

const widgetTab = (p) =>
	p
		.getByRole("tab", { name: "Widget" })
		.or(p.getByRole("button", { name: "Widget", exact: true }))
		.or(p.getByText("Widget", { exact: true }))
		.first();

const makeShots = (IDS) => [
	{
		name: "sign-in",
		auth: false,
		url: `${DASH}/sign-in`,
		prep: (p) => settle(p, 1500),
	},
	{
		name: "sign-up",
		auth: false,
		url: `${DASH}/sign-up`,
		prep: (p) => settle(p, 1500),
	},
	{
		name: "onboarding",
		url: `${DASH}/onboarding?new=1`,
		prep: async (p) => {
			await p
				.getByText("support agent", { exact: false })
				.first()
				.waitFor({ timeout: 30_000 });
			await settle(p, 1500);
		},
	},
	{ name: "inbox", url: `${DASH}/inbox`, prep: waitInbox },
	{
		name: "inbox-filters",
		url: `${DASH}/inbox`,
		prep: async (p) => {
			await waitInbox(p);
			await p.locator('button[aria-label="Filters"]').click();
			await settle(p, 600);
		},
	},
	{
		name: "notifications",
		url: `${DASH}/inbox`,
		prep: async (p) => {
			await waitInbox(p);
			await p.locator('button[aria-label^="Notifications"]').click();
			await settle(p, 800);
		},
	},
	{
		name: "command-palette",
		url: `${DASH}/inbox`,
		prep: async (p) => {
			await waitInbox(p);
			await p.keyboard.press("ControlOrMeta+k");
			await settle(p, 400);
			await p.keyboard.type("stock", { delay: 60 });
			await settle(p, 1200);
		},
	},
	{
		name: "conversation-thread",
		url: `${DASH}/inbox?project=${P}&c=${IDS.sofia}`,
		prep: async (p) => {
			await p
				.getByText("CSV", { exact: false })
				.first()
				.waitFor({ timeout: 30_000 });
			await settle(p, 1500);
		},
	},
	{
		name: "conversation-escalated",
		url: `${DASH}/inbox?project=${P}&c=${IDS.priya}`,
		prep: async (p) => {
			await p
				.getByText("Escalated", { exact: false })
				.first()
				.waitFor({ timeout: 30_000 });
			await settle(p, 1500);
		},
	},
	{
		name: "conversation-resolved",
		url: `${DASH}/inbox?project=${P}&c=${IDS.marcus}`,
		prep: async (p) => {
			await p
				.getByText("Resolved", { exact: false })
				.first()
				.waitFor({ timeout: 30_000 });
			await settle(p, 1500);
		},
	},
	{
		name: "conversation-knowledge",
		url: `${DASH}/inbox?project=${P}&c=${IDS.lena}`,
		prep: async (p) => {
			await p
				.getByText("Reports", { exact: false })
				.first()
				.waitFor({ timeout: 30_000 });
			await settle(p, 1500);
		},
	},
	{
		name: "projects",
		url: `${DASH}/settings/projects`,
		prep: async (p) => {
			await p
				.getByText("Acme Tools (demo)")
				.first()
				.waitFor({ timeout: 30_000 });
			await settle(p);
		},
	},
	{
		name: "project-general",
		url: `${DASH}/settings/projects/${P}`,
		prep: async (p) => {
			await p
				.getByText("Acme Tools (demo)")
				.first()
				.waitFor({ timeout: 30_000 });
			await settle(p);
		},
	},
	{
		name: "project-widget",
		url: `${DASH}/settings/projects/${P}`,
		prep: async (p) => {
			await p
				.getByText("Acme Tools (demo)")
				.first()
				.waitFor({ timeout: 30_000 });
			await widgetTab(p).click();
			await settle(p, 1200);
		},
	},
	{
		name: "embed-snippet",
		url: `${DASH}/settings/projects/${P}`,
		prep: async (p) => {
			await p
				.getByText("Acme Tools (demo)")
				.first()
				.waitFor({ timeout: 30_000 });
			await widgetTab(p).click();
			await settle(p, 800);
			const snippet = p.getByText("widget.js", { exact: false }).first();
			await snippet.waitFor({ timeout: 15_000 });
			await snippet.scrollIntoViewIfNeeded();
			await settle(p, 600);
		},
	},
	{
		name: "project-behavior",
		url: `${DASH}/settings/projects/${P}`,
		prep: async (p) => {
			await p
				.getByText("Acme Tools (demo)")
				.first()
				.waitFor({ timeout: 30_000 });
			await p
				.getByRole("tab", { name: "Behavior" })
				.or(p.getByRole("button", { name: "Behavior", exact: true }))
				.or(p.getByText("Behavior", { exact: true }))
				.first()
				.click();
			await settle(p, 1200);
		},
	},
	{
		name: "sources",
		url: `${DASH}/settings/projects/${P}/sources`,
		prep: async (p) => {
			await p
				.getByText("llms.txt", { exact: false })
				.first()
				.waitFor({ timeout: 30_000 });
			await settle(p);
		},
	},
	{
		name: "workspaces",
		url: `${DASH}/settings/workspaces`,
		prep: async (p) => {
			await p.getByText("Dev Workspace").first().waitFor({ timeout: 30_000 });
			await settle(p);
		},
	},
	{
		name: "account",
		url: `${DASH}/settings/account`,
		prep: async (p) => {
			await p.getByText("Danger zone").first().waitFor({ timeout: 30_000 });
			await settle(p);
		},
	},
	{
		name: "billing",
		url: `${DASH}/settings/billing`,
		prep: async (p) => {
			await p
				.getByText("Billing", { exact: false })
				.first()
				.waitFor({ timeout: 30_000 });
			await settle(p, 1500);
		},
	},
	{
		name: "widget",
		url: SHOWCASE,
		prep: async (p) => {
			const bubble = p
				.locator("#llmchat-widget-root")
				.locator(".llmchat-bubble");
			await bubble.waitFor({ timeout: 30_000 });
			await bubble.click();
			await p
				.locator('[role="dialog"][aria-label="Support chat"]')
				.waitFor({ timeout: 15_000 });
			await settle(p, 1200);
		},
	},
	{
		name: "embed-page",
		auth: false,
		url: `${APIURL}/embed/local-dev-key`,
		prep: (p) => settle(p, 2000),
	},
];

async function main() {
	const browser = await chromium.launch();
	const cookie = await signIn();
	const shots = makeShots(await lookupIds(cookie));

	let failed = 0;
	const only = process.argv[2] ? process.argv[2].split(",") : null;
	for (const shot of shots) {
		if (only && !only.includes(shot.name)) continue;
		for (const theme of ["light", "dark"]) {
			const ctx = await browser.newContext({
				viewport: { width: 1440, height: 900 },
				deviceScaleFactor: 2,
				reducedMotion: "reduce",
			});
			if (shot.auth !== false) {
				await ctx.addCookies([cookie]);
			}
			await ctx.addInitScript(
				`try { localStorage.setItem("theme", "${theme}"); } catch {}`,
			);
			const page = await ctx.newPage();
			try {
				await page.goto(shot.url, { waitUntil: "load", timeout: 60_000 });
				await shot.prep(page);
				await page.screenshot({ path: `${OUT}/${shot.name}-${theme}.png` });
				console.log(`ok ${shot.name}-${theme}`);
			} catch (e) {
				failed += 1;
				console.error(
					`FAIL ${shot.name}-${theme}: ${e.message.split("\n")[0]}`,
				);
			}
			await ctx.close();
		}
	}
	await browser.close();
	if (failed) {
		console.error(`${failed} screenshot(s) failed`);
		process.exit(1);
	}
}

main();
