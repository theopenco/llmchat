import { afterEach, describe, expect, it, vi } from "vitest";

import {
	notifySubscriptionCancelled,
	notifySubscriptionStarted,
	notifyUserSignup,
	postDiscordWebhook,
	sendDiscordNotification,
} from "./discord";

import type { Env } from "@/env";

const WEBHOOK = "https://discord.com/api/webhooks/123/abc";

const env = (vars: Record<string, string> = {}) => ({ vars }) as unknown as Env;

interface Sent {
	url: string;
	body: {
		content?: string;
		embeds?: Array<{
			title: string;
			color?: number;
			fields?: Array<{ name: string; value: string }>;
		}>;
	};
}

function stubFetch(status = 204) {
	const calls: Sent[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string | URL, init?: RequestInit) => {
			calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
			return new Response(status >= 400 ? "boom" : null, { status });
		}),
	);
	return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("sendDiscordNotification", () => {
	it("no-ops when the webhook URL is unset or blank", async () => {
		const calls = stubFetch();
		await sendDiscordNotification(undefined, { content: "hi" });
		await sendDiscordNotification("   ", { content: "hi" });
		expect(calls).toHaveLength(0);
	});

	it("POSTs the payload as JSON to the webhook", async () => {
		const calls = stubFetch();
		await sendDiscordNotification(WEBHOOK, { content: "hi" });
		expect(calls).toEqual([{ url: WEBHOOK, body: { content: "hi" } }]);
	});

	it("swallows HTTP failures — a notification can never break the caller", async () => {
		stubFetch(500);
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(
			sendDiscordNotification(WEBHOOK, { content: "hi" }),
		).resolves.toBeUndefined();
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("swallows network failures too", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("offline");
			}),
		);
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(
			sendDiscordNotification(WEBHOOK, { content: "hi" }),
		).resolves.toBeUndefined();
		spy.mockRestore();
	});
});

describe("postDiscordWebhook", () => {
	it("throws on a non-2xx response (the traffic cron must fail visibly)", async () => {
		stubFetch(403);
		await expect(postDiscordWebhook(WEBHOOK, { content: "x" })).rejects.toThrow(
			/responded 403/,
		);
	});
});

describe("notification embeds", () => {
	it("signup: green embed with email + name, falling back to Unknown", async () => {
		const calls = stubFetch();
		await notifyUserSignup(env({ DISCORD_NOTIFICATION_URL: WEBHOOK }), {
			email: "ada@example.com",
			name: null,
		});
		const embed = calls[0]!.body.embeds![0]!;
		expect(embed.title).toBe("New User Signup");
		expect(embed.color).toBe(0x22c55e);
		expect(embed.fields).toEqual([
			{ name: "Email", value: "ada@example.com", inline: true },
			{ name: "Name", value: "Unknown", inline: true },
		]);
	});

	it("signup: no-ops without DISCORD_NOTIFICATION_URL (local dev, self-hosters)", async () => {
		const calls = stubFetch();
		await notifyUserSignup(env(), { email: "a@b.c", name: "A" });
		expect(calls).toHaveLength(0);
	});

	it("subscription started: green embed with workspace + uppercased plan", async () => {
		const calls = stubFetch();
		await notifySubscriptionStarted(
			env({ DISCORD_NOTIFICATION_URL: WEBHOOK }),
			{
				email: "owner@example.com",
				workspaceName: "Acme",
				plan: "growth",
			},
		);
		const embed = calls[0]!.body.embeds![0]!;
		expect(embed.title).toBe("New Subscriber");
		expect(embed.fields).toEqual([
			{ name: "Email", value: "owner@example.com", inline: true },
			{ name: "Workspace", value: "Acme", inline: true },
			{ name: "Plan", value: "GROWTH", inline: true },
		]);
	});

	it("subscription cancelled: red embed", async () => {
		const calls = stubFetch();
		await notifySubscriptionCancelled(
			env({ DISCORD_NOTIFICATION_URL: WEBHOOK }),
			{ email: null, workspaceName: null, plan: "scale" },
		);
		const embed = calls[0]!.body.embeds![0]!;
		expect(embed.title).toBe("Subscription Cancelled");
		expect(embed.color).toBe(0xef4444);
		expect(embed.fields).toEqual([
			{ name: "Email", value: "Unknown", inline: true },
			{ name: "Workspace", value: "Unknown", inline: true },
			{ name: "Plan", value: "SCALE", inline: true },
		]);
	});
});
