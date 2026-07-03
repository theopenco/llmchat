import type { Env } from "@/env";

// Discord incoming-webhook notifications for operators (same automation set as
// llmgateway): new signups and subscription lifecycle events go to the channel
// behind DISCORD_NOTIFICATION_URL; the traffic report posts to its own webhook
// (see lib/traffic-report.ts). Plain fetch — no discord.js — so it bundles for
// workerd. Everything no-ops when the webhook env is unset, so local dev and
// self-hosters need zero Discord setup.

/** Minimal Discord embed shape (discord.com/developers/docs/resources/webhook). */
export interface DiscordEmbed {
	title: string;
	description?: string;
	color?: number;
	fields?: Array<{ name: string; value: string; inline?: boolean }>;
	footer?: { text: string };
	timestamp?: string;
}

export interface DiscordWebhookPayload {
	content?: string;
	embeds?: DiscordEmbed[];
}

const GREEN = 0x22c55e;
const RED = 0xef4444;

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Low-level webhook POST — THROWS on HTTP/network failure. Use this where a
 * failure should be visible (the traffic-report cron marks its execution
 * failed); use sendDiscordNotification on request paths, where notifications
 * must never break the caller.
 */
export async function postDiscordWebhook(
	url: string,
	payload: DiscordWebhookPayload,
): Promise<void> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	if (!res.ok) {
		throw new Error(`Discord webhook responded ${res.status}`);
	}
}

/**
 * Best-effort notification: skipped when the webhook URL is unset, and any
 * failure is logged but swallowed — an operator ping must never break sign-up
 * or a Stripe webhook. Run inside waitUntil where a ctx is available.
 */
export async function sendDiscordNotification(
	webhookUrl: string | undefined,
	payload: DiscordWebhookPayload,
): Promise<void> {
	const url = webhookUrl?.trim();
	if (!url) {
		return;
	}
	try {
		await postDiscordWebhook(url, payload);
	} catch (err) {
		console.error("discord: notification failed", err);
	}
}

/** Every new account (email or OAuth — both insert a `user` row). */
export async function notifyUserSignup(
	env: Env,
	user: { email?: string | null; name?: string | null },
): Promise<void> {
	await sendDiscordNotification(env.vars.DISCORD_NOTIFICATION_URL, {
		embeds: [
			{
				title: "New User Signup",
				color: GREEN,
				fields: [
					{ name: "Email", value: user.email || "Unknown", inline: true },
					{ name: "Name", value: user.name || "Unknown", inline: true },
				],
				timestamp: new Date().toISOString(),
			},
		],
	});
}

/** A workspace completed Checkout for a paid tier (checkout.session.completed). */
export async function notifySubscriptionStarted(
	env: Env,
	input: {
		email?: string | null;
		workspaceName?: string | null;
		plan: string;
	},
): Promise<void> {
	await sendDiscordNotification(env.vars.DISCORD_NOTIFICATION_URL, {
		embeds: [
			{
				title: "New Subscriber",
				color: GREEN,
				fields: [
					{ name: "Email", value: input.email || "Unknown", inline: true },
					{
						name: "Workspace",
						value: input.workspaceName || "Unknown",
						inline: true,
					},
					{ name: "Plan", value: input.plan.toUpperCase(), inline: true },
				],
				timestamp: new Date().toISOString(),
			},
		],
	});
}

/** A subscription ended (customer.subscription.deleted). */
export async function notifySubscriptionCancelled(
	env: Env,
	input: {
		email?: string | null;
		workspaceName?: string | null;
		plan: string;
	},
): Promise<void> {
	await sendDiscordNotification(env.vars.DISCORD_NOTIFICATION_URL, {
		embeds: [
			{
				title: "Subscription Cancelled",
				color: RED,
				fields: [
					{ name: "Email", value: input.email || "Unknown", inline: true },
					{
						name: "Workspace",
						value: input.workspaceName || "Unknown",
						inline: true,
					},
					{ name: "Plan", value: input.plan.toUpperCase(), inline: true },
				],
				timestamp: new Date().toISOString(),
			},
		],
	});
}
