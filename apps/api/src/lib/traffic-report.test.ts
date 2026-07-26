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
	probeShowcaseWidget,
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

// The weekly showcase-demo health probe (task #125 regression guard): a dead
// public demo must surface as a Monday digest line, never fail the cron.
describe("probeShowcaseWidget", () => {
	it("PASSes when the key resolves and one chat round-trip streams a body", async () => {
		const calls: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string | URL, init?: RequestInit) => {
				calls.push(String(url));
				if (String(url).includes("/v1/config/")) {
					return Response.json({ brandColor: "#123456" });
				}
				expect(String(url)).toContain("/v1/chat");
				const body = JSON.parse(String(init?.body));
				// The fixed clientId keeps every weekly probe in ONE conversation.
				expect(body.clientId).toBe("traffic-report-probe");
				expect(body.projectKey).toBe("pk_test");
				return new Response("data: hello");
			}),
		);
		const result = await probeShowcaseWidget("https://api.example", "pk_test");
		expect(result).toEqual({ ok: true, detail: "config 200 · chat 200" });
		expect(calls).toHaveLength(2);
	});

	it("FAILs fast on a dead key (config 404) without spending a chat call", async () => {
		const fetchSpy = vi.fn(async () => new Response(null, { status: 404 }));
		vi.stubGlobal("fetch", fetchSpy);
		const result = await probeShowcaseWidget("https://api.example", "pk_dead");
		expect(result.ok).toBe(false);
		expect(result.detail).toContain("config 404");
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it("FAILs on a chat error status and on an empty stream", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string | URL) =>
				String(url).includes("/v1/config/")
					? Response.json({})
					: new Response("nope", { status: 429 }),
			),
		);
		expect(
			(await probeShowcaseWidget("https://api.example", "pk_test")).detail,
		).toContain("chat 429");

		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string | URL) =>
				String(url).includes("/v1/config/")
					? Response.json({})
					: new Response("   "),
			),
		);
		expect(
			(await probeShowcaseWidget("https://api.example", "pk_test")).detail,
		).toContain("empty stream");
	});

	it("never throws — network errors become the digest FAIL detail", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("connection refused");
			}),
		);
		const result = await probeShowcaseWidget("https://api.example", "pk_test");
		expect(result.ok).toBe(false);
		expect(result.detail).toContain("connection refused");
	});
});

describe("showcase probe wiring", () => {
	const DATA = {
		perHost: [],
		overall: [],
		events: [],
		sources: [],
		botSplit: [],
	};

	it("buildTrafficEmbed appends the PASS/FAIL line only when a probe ran", () => {
		const window = buildWindow("week", new Date("2026-07-01T00:00:00Z"));
		expect(buildTrafficEmbed(window, DATA).description).not.toContain(
			"Showcase demo",
		);
		expect(
			buildTrafficEmbed(window, DATA, {
				ok: true,
				detail: "config 200 · chat 200",
			}).description,
		).toContain("**Showcase demo** · ✅ PASS — config 200 · chat 200");
		expect(
			buildTrafficEmbed(window, DATA, { ok: false, detail: "config 404" })
				.description,
		).toContain("**Showcase demo** · ❌ FAIL — config 404");
	});

	it("weekly report with SHOWCASE_WIDGET_KEY probes and posts the digest line", async () => {
		const calls: string[] = [];
		let discordBody = "";
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string | URL, init?: RequestInit) => {
				const u = String(url);
				calls.push(u);
				if (u.includes("discord.com")) {
					discordBody = String(init?.body);
					return new Response(null, { status: 204 });
				}
				if (u.includes("/v1/config/")) {
					return Response.json({});
				}
				if (u.includes("/v1/chat")) {
					return new Response("data: hi");
				}
				return Response.json({ results: [] });
			}),
		);
		await runTrafficReport(
			env({ ...CONFIGURED, SHOWCASE_WIDGET_KEY: "pk_probe" }),
			"week",
		);
		// Defaults to the prod public origin when API_PUBLIC_ORIGIN is unset.
		expect(calls).toContain(
			"https://api.clankersupport.com/v1/config/pk_probe",
		);
		expect(calls).toContain("https://api.clankersupport.com/v1/chat");
		expect(JSON.parse(discordBody).embeds[0].description).toContain(
			"**Showcase demo** · ✅ PASS",
		);
	});

	it("monthly runs and unset keys never probe", async () => {
		const calls: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string | URL) => {
				calls.push(String(url));
				return String(url).includes("discord.com")
					? new Response(null, { status: 204 })
					: Response.json({ results: [] });
			}),
		);
		await runTrafficReport(
			env({ ...CONFIGURED, SHOWCASE_WIDGET_KEY: "pk_probe" }),
			"month",
		);
		await runTrafficReport(env(CONFIGURED), "week");
		expect(calls.some((u) => u.includes("/v1/"))).toBe(false);
	});
});
