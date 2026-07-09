// Records the integrations demo as one continuous video with Playwright
// (Playwright pierces the widget's shadow DOM, which selector-based screen
// recorders cannot):
//   1. Dashboard → project settings → Integrations tab (cards + pairing code)
//   2. Showcase widget: book a call (Cal.com/Zoom), order lookup + return (Shopify)
//   3. Dashboard inbox: the persisted conversation
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
// Playwright is a dev dep of apps/docs (screenshot tooling) — resolve from there.
const repoRoot = join(fileURLToPath(import.meta.url), "../../../../..");
const require = createRequire(join(repoRoot, "apps/docs/package.json"));
const { chromium } = require("playwright");

const OUT_DIR = join(repoRoot, ".demo-video");
const DASH = "http://localhost:3001";
const SHOW = "http://localhost:3003";

const browser = await chromium.launch();
const ctx = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } },
	colorScheme: "light",
});
const page = await ctx.newPage();
const beat = (ms = 1200) => page.waitForTimeout(ms);

/* ── Scene 1: dashboard sign-in → Integrations tab ─────────────────────── */
await page.goto(`${DASH}/sign-in`);
await page.waitForLoadState("networkidle");
await beat(800);
await page
	.locator("#email")
	.pressSequentially("admin@example.com", { delay: 35 });
await page.locator("#password").fill("admin@example.com");
await beat(400);
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForURL(/inbox|onboarding/, { timeout: 30_000 });
await beat();
// Dismiss the consent banner so it doesn't overlap the scenes.
const consent = page.getByRole("button", { name: "Decline" });
if (await consent.isVisible().catch(() => false)) {
	await consent.click();
	await beat(400);
}

await page.goto(`${DASH}/settings/projects`);
await page.getByText("Acme Tools (demo)").first().waitFor({ timeout: 20_000 });
await beat(800);
await page.getByLabel("Configure").first().click();
await page.waitForURL(/settings\/projects\//, { timeout: 20_000 });
await beat(900);
await page.getByRole("button", { name: "Integrations" }).click();
await page.getByText("Cal.com scheduling").waitFor({ timeout: 15_000 });
await beat(3000);
// Show the Shopify pairing-code flow (safe: minting doesn't change config;
// "Replace credentials" only reveals the setup panel until a form submits).
await page.getByRole("button", { name: "Replace credentials" }).last().click();
await beat(900);
await page.getByRole("button", { name: /generate pairing code/i }).click();
await page.getByTestId("pair-code").waitFor({ timeout: 15_000 });
await beat(2400);
await page.getByRole("button", { name: "Done" }).click();
await beat(600);

/* ── Scene 2: showcase widget — the agent acts ─────────────────────────── */
await page.goto(SHOW);
await page.waitForLoadState("networkidle");
const bubble = page.locator(".llmchat-bubble").last();
await bubble.waitFor({ timeout: 30_000 });
await beat(1000);
await bubble.click();
await page.locator(".llmchat-identify").last().waitFor({ timeout: 10_000 });
await beat(600);
await page
	.locator('input[placeholder="Your name"]')
	.last()
	.pressSequentially("Mia", { delay: 60 });
await page
	.locator('input[placeholder="you@example.com"]')
	.last()
	.pressSequentially("mia@example.com", { delay: 30 });
await beat(400);
await page.getByRole("button", { name: "Start chat" }).last().click();
await beat(800);

const composer = page.locator('[placeholder="Type a message…"]').last();
async function ask(text, waitForReply, timeout = 45_000) {
	await composer.click();
	await composer.pressSequentially(text, { delay: 28 });
	await beat(350);
	await composer.press("Enter");
	await page.getByText(waitForReply).last().waitFor({ timeout });
	await beat(3200);
}

await ask(
	"Hi! Can I book a call with your team this week?",
	"Which one works for you?",
);
await ask("The 10:30 one works — book it please!", "You're all set!");
await ask("Also, where is my order #1001?", "Tracking:");
await ask(
	"The wrench is too small — please return it from order #1001.",
	"filed return #1001-R1",
);
await beat(1500);

/* ── Scene 3: the whole exchange landed in the inbox ───────────────────── */
await page.goto(`${DASH}/inbox`);
await page.waitForLoadState("networkidle");
await page.getByText("Mia", { exact: false }).first().click();
await page
	.getByText("zoom.us", { exact: false })
	.first()
	.waitFor({ timeout: 20_000 });
await beat(2500);
await page.mouse.move(870, 450);
await page.mouse.wheel(0, 700);
await beat(1500);
await page.mouse.wheel(0, 700);
await beat(2400);

await ctx.close();
const video = await page.video().path();
console.log("VIDEO:", video);
await browser.close();
