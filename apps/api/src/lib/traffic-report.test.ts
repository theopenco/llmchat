import { afterEach, describe, expect, it, vi } from "vitest";

import {
	TRAFFIC_CRON_MONTHLY,
	TRAFFIC_CRON_WEEKLY,
	buildQueries,
	buildTrafficEmbed,
	buildWindow,
	formatDelta,
	hogqlTimestamp,
	periodForCron,
	renderTable,
	runTrafficReport,
} from "./traffic-report";

import type { Env } from "@/env";

const env = (vars: Record<string, string> = {}) => ({ vars }) as unknown as Env;

const CONFIGURED = {
	POSTHOG_PERSONAL_API_KEY: "phx_test",
	POSTHOG_PROJECT_ID: "424242",
	DISCORD_TRAFFIC_NOTIFICATION_URL: "https://discord.com/api/webhooks/9/z",
};

afterEach(() => vi.unstubAllGlobals());

describe("periodForCron", () => {
	it("maps the ploy.yaml expressions to their reporting period", () => {
		expect(periodForCron(TRAFFIC_CRON_WEEKLY)).toBe("week");
		expect(periodForCron(TRAFFIC_CRON_MONTHLY)).toBe("month");
		// Unknown expressions default to the weekly report rather than crashing.
		expect(periodForCron("*/5 * * * *")).toBe("week");
	});
});

describe("buildWindow", () => {
	it("week: reports the just-completed Mon–Sun week (UTC)", () => {
		// Wednesday → the completed week ended last Monday 00:00.
		const w = buildWindow("week", new Date("2026-07-01T12:34:56Z"));
		expect(hogqlTimestamp(w.curStart)).toBe("2026-06-22 00:00:00");
		expect(hogqlTimestamp(w.curEnd)).toBe("2026-06-29 00:00:00");
		expect(hogqlTimestamp(w.prevStart)).toBe("2026-06-15 00:00:00");
		expect(w.rangeLabel).toBe("2026-06-22 – 2026-06-28");
	});

	it("week: a Monday-morning run reports the week that just ended", () => {
		const w = buildWindow("week", new Date("2026-07-06T08:00:00Z"));
		expect(hogqlTimestamp(w.curStart)).toBe("2026-06-29 00:00:00");
		expect(hogqlTimestamp(w.curEnd)).toBe("2026-07-06 00:00:00");
	});

	it("week: Sunday still belongs to the running week (reports the prior one)", () => {
		const w = buildWindow("week", new Date("2026-07-05T23:59:59Z"));
		expect(hogqlTimestamp(w.curEnd)).toBe("2026-06-29 00:00:00");
	});

	it("month: reports the last calendar month, with year rollover", () => {
		const june = buildWindow("month", new Date("2026-07-01T08:30:00Z"));
		expect(hogqlTimestamp(june.curStart)).toBe("2026-06-01 00:00:00");
		expect(hogqlTimestamp(june.curEnd)).toBe("2026-07-01 00:00:00");
		expect(hogqlTimestamp(june.prevStart)).toBe("2026-05-01 00:00:00");
		expect(june.rangeLabel).toBe("June 2026");

		const december = buildWindow("month", new Date("2026-01-15T00:00:00Z"));
		expect(hogqlTimestamp(december.curStart)).toBe("2025-12-01 00:00:00");
		expect(hogqlTimestamp(december.prevStart)).toBe("2025-11-01 00:00:00");
		expect(december.rangeLabel).toBe("December 2025");
	});
});

describe("formatDelta", () => {
	it("formats growth, decline, from-zero, and still-zero", () => {
		expect(formatDelta(10, 5)).toBe("+100.0%");
		expect(formatDelta(5, 10)).toBe("-50.0%");
		expect(formatDelta(5, 5)).toBe("+0.0%");
		expect(formatDelta(3, 0)).toBe("new");
		expect(formatDelta(0, 0)).toBe("–");
	});
});

describe("renderTable", () => {
	it("left-aligns the first column and right-aligns the rest", () => {
		expect(
			renderTable(
				["Metric", "Now"],
				[
					["pageviews", "1,204"],
					["visitors", "87"],
				],
			),
		).toBe("Metric       Now\npageviews  1,204\nvisitors      87");
	});
});

describe("buildQueries", () => {
	it("scopes to the clankersupport hosts, taxonomy events, and window", () => {
		const q = buildQueries(
			buildWindow("week", new Date("2026-07-01T00:00:00Z")),
		);
		// Pageview queries are host-scoped; the events query counts the taxonomy
		// events wherever they're captured (api-side events carry no $host).
		for (const query of [q.perHost, q.overall, q.sources, q.botSplit]) {
			expect(query).toContain("'clankersupport.com'");
		}
		expect(q.perHost).toContain("'app.clankersupport.com'");
		expect(q.events).toContain("'signup_completed'");
		expect(q.events).toContain("'conversation_escalated'");
		expect(q.overall).toContain("toDateTime('2026-06-22 00:00:00')");
		expect(q.overall).toContain("toDateTime('2026-06-29 00:00:00')");
		// Top sources only cover the current period.
		expect(q.sources).not.toContain("2026-06-15");
	});
});

describe("buildTrafficEmbed", () => {
	const window = buildWindow("week", new Date("2026-07-01T00:00:00Z"));
	const embed = buildTrafficEmbed(window, {
		perHost: [
			["clankersupport.com", "current", 900, 300, 350],
			["www.clankersupport.com", "current", 100, 40, 45],
			["clankersupport.com", "previous", 500, 200, 210],
			["app.clankersupport.com", "current", 200, 20, 30],
			["unknown-host.example", "current", 999, 999, 999],
		],
		overall: [
			["current", 1200, 340, 400],
			["previous", 600, 250, 280],
		],
		events: [
			["signup_completed", "current", 12],
			["signup_completed", "previous", 8],
			["conversation_started", "current", 55],
		],
		sources: [
			["google.com", 120],
			["$direct", 90],
		],
		botSplit: [
			["current", "human", 900],
			["current", "bot", 80],
			["current", "ai", 20],
			["previous", "human", 500],
		],
	});

	it("titles by period and range", () => {
		expect(embed.title).toBe(
			"📈 Weekly Traffic Report · 2026-06-22 – 2026-06-28",
		);
	});

	it("sums overview totals and computes deltas", () => {
		expect(embed.description).toMatch(/pageviews +1,200 +600 +\+100\.0%/);
		expect(embed.description).toMatch(/visitors +340 +250 +\+36\.0%/);
	});

	it("merges www + apex into one Marketing row and drops unknown hosts", () => {
		expect(embed.description).toMatch(/Marketing +1,000 +340 +\+100\.0%/);
		expect(embed.description).not.toContain("999");
	});

	it("labels taxonomy events and zero-fills missing ones", () => {
		expect(embed.description).toMatch(/Signups +12 +8 +\+50\.0%/);
		expect(embed.description).toMatch(/Escalations +0 +0 +–/);
		expect(embed.description).toMatch(/Conversations +55 +0 +new/);
	});

	it("reports the automated traffic share", () => {
		// (80 bot + 20 ai) / 1000 current views = 10%.
		expect(embed.description).toContain("10.0% automated");
	});
});

describe("runTrafficReport", () => {
	it("skips quietly when the query credentials or webhook are unset", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		await runTrafficReport(env(), "week");
		await runTrafficReport(
			env({ POSTHOG_PERSONAL_API_KEY: "phx", POSTHOG_PROJECT_ID: "1" }),
			"week",
		);
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledTimes(2);
		log.mockRestore();
	});

	it("runs five HogQL queries against the project and posts one embed", async () => {
		const calls: Array<{ url: string; auth?: string; body: string }> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string | URL, init?: RequestInit) => {
				const headers = new Headers(init?.headers);
				calls.push({
					url: String(url),
					auth: headers.get("authorization") ?? undefined,
					body: String(init?.body),
				});
				if (String(url).includes("discord.com")) {
					return new Response(null, { status: 204 });
				}
				return Response.json({ results: [] });
			}),
		);

		await runTrafficReport(env(CONFIGURED), "month");

		const posthog = calls.filter((c) => !c.url.includes("discord.com"));
		expect(posthog).toHaveLength(5);
		for (const call of posthog) {
			expect(call.url).toBe(
				"https://eu.posthog.com/api/projects/424242/query/",
			);
			expect(call.auth).toBe("Bearer phx_test");
			expect(JSON.parse(call.body).query.kind).toBe("HogQLQuery");
		}
		const discord = calls.filter((c) => c.url.includes("discord.com"));
		expect(discord).toHaveLength(1);
		const embed = JSON.parse(discord[0]!.body).embeds[0];
		expect(embed.title).toContain("Monthly Traffic Report");
	});

	it("honors POSTHOG_QUERY_HOST overrides", async () => {
		const urls: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string | URL) => {
				urls.push(String(url));
				return String(url).includes("discord.com")
					? new Response(null, { status: 204 })
					: Response.json({ results: [] });
			}),
		);
		await runTrafficReport(
			env({ ...CONFIGURED, POSTHOG_QUERY_HOST: "https://us.posthog.com" }),
			"week",
		);
		expect(urls.some((u) => u.startsWith("https://us.posthog.com/"))).toBe(
			true,
		);
	});

	it("throws when a PostHog query fails so the cron records the failure", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("nope", { status: 500 })),
		);
		await expect(runTrafficReport(env(CONFIGURED), "week")).rejects.toThrow(
			/PostHog query failed: 500/,
		);
	});
});
