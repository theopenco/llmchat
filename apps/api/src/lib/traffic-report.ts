import { ANALYTICS_EVENTS } from "@llmchat/shared";

import { postDiscordWebhook } from "@/lib/discord";

import type { Env } from "@/env";
import type { DiscordEmbed } from "@/lib/discord";

// Weekly/monthly traffic report: query the clankersupport PostHog project over
// the HogQL API and post a digest embed to the #traffic Discord channel.
// Ported from llmgateway's packages/scripts/src/traffic-report.ts, but run by
// a Ploy cron trigger (cron: block in apps/api/ploy.yaml → the `scheduled`
// export in src/index.ts) instead of a GitHub Actions workflow, so it ships
// with the worker and self-hosters get it from env config alone.
//
// Requires a PostHog PERSONAL API key (read scope — not the phc_ ingestion
// key) plus the numeric project id; the report is skipped with a log line
// when any required env is missing, and THROWS on query/post failure so the
// cron execution is marked failed instead of silently succeeding.

export type ReportPeriod = "week" | "month";

// Cron schedules — MUST match the cron: block in apps/api/ploy.yaml. Ploy
// hands the fired expression to the scheduled handler (event.cron), which maps
// it back to a reporting period here.
export const TRAFFIC_CRON_WEEKLY = "0 8 * * 1";
export const TRAFFIC_CRON_MONTHLY = "30 8 1 * *";

export function periodForCron(cron: string): ReportPeriod {
	return cron.trim() === TRAFFIC_CRON_MONTHLY ? "month" : "week";
}

// The properties (product surfaces) the report covers. Multiple hosts can map
// to one label (www + apex are both the marketing site).
const PRODUCTS = [
	{
		hosts: ["clankersupport.com", "www.clankersupport.com"],
		label: "Marketing",
	},
	{ hosts: ["app.clankersupport.com"], label: "Dashboard" },
	{ hosts: ["showcase.clankersupport.com"], label: "Showcase" },
] as const;

// Conversion/engagement events worth a weekly glance — names come from the
// shared taxonomy so the report can never drift from what the apps capture.
const EVENTS = [
	{ event: ANALYTICS_EVENTS.signupCompleted, label: "Signups" },
	{ event: ANALYTICS_EVENTS.onboardingCompleted, label: "Onboarding done" },
	{ event: ANALYTICS_EVENTS.projectCreated, label: "Projects created" },
	{ event: ANALYTICS_EVENTS.widgetEmbedCopied, label: "Embeds copied" },
	{ event: ANALYTICS_EVENTS.conversationStarted, label: "Conversations" },
	{ event: ANALYTICS_EVENTS.conversationEscalated, label: "Escalations" },
	{ event: ANALYTICS_EVENTS.ctaClicked, label: "CTA clicks" },
] as const;

const HOST_LIST = PRODUCTS.flatMap((p) => p.hosts)
	.map((h) => `'${h}'`)
	.join(",");
const EVENT_LIST = EVENTS.map((e) => `'${e.event}'`).join(",");

const REQUEST_TIMEOUT_MS = 30_000;

export interface ReportWindow {
	period: ReportPeriod;
	/** Previous period is [prevStart, curStart); current is [curStart, curEnd). */
	prevStart: Date;
	curStart: Date;
	curEnd: Date;
	rangeLabel: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD HH:MM:SS` (UTC), the literal form HogQL's toDateTime expects. */
export function hogqlTimestamp(d: Date): string {
	return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * The reporting window for a run at `now` (all UTC): for "week" the
 * just-completed Mon–Sun week vs the week before; for "month" the last
 * calendar month vs the month before.
 */
export function buildWindow(period: ReportPeriod, now: Date): ReportWindow {
	if (period === "month") {
		const curEnd = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
		);
		const curStart = new Date(
			Date.UTC(curEnd.getUTCFullYear(), curEnd.getUTCMonth() - 1, 1),
		);
		const prevStart = new Date(
			Date.UTC(curStart.getUTCFullYear(), curStart.getUTCMonth() - 1, 1),
		);
		return {
			period,
			prevStart,
			curStart,
			curEnd,
			rangeLabel: `${MONTHS[curStart.getUTCMonth()]} ${curStart.getUTCFullYear()}`,
		};
	}
	// Monday of the current week (UTC) is the end of the completed week.
	const daysSinceMonday = (now.getUTCDay() + 6) % 7;
	const curEnd = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
			daysSinceMonday * DAY_MS,
	);
	const curStart = new Date(curEnd.getTime() - 7 * DAY_MS);
	const prevStart = new Date(curEnd.getTime() - 14 * DAY_MS);
	return {
		period,
		prevStart,
		curStart,
		curEnd,
		rangeLabel: `${isoDate(curStart)} – ${isoDate(new Date(curEnd.getTime() - DAY_MS))}`,
	};
}

export interface TrafficQueries {
	perHost: string;
	overall: string;
	events: string;
	sources: string;
	botSplit: string;
}

/** The HogQL statements for a window. Pure so tests can assert their shape. */
export function buildQueries(window: ReportWindow): TrafficQueries {
	const curStart = hogqlTimestamp(window.curStart);
	const curEnd = hogqlTimestamp(window.curEnd);
	const prevStart = hogqlTimestamp(window.prevStart);
	const periodExpr = `if(timestamp >= toDateTime('${curStart}'), 'current', 'previous')`;
	const rangeExpr = `timestamp >= toDateTime('${prevStart}') AND timestamp < toDateTime('${curEnd}')`;
	const currentRangeExpr = `timestamp >= toDateTime('${curStart}') AND timestamp < toDateTime('${curEnd}')`;

	return {
		perHost: `
			SELECT properties.$host AS host, ${periodExpr} AS period,
				count() AS pageviews,
				count(DISTINCT person_id) AS visitors,
				count(DISTINCT properties.$session_id) AS sessions
			FROM events
			WHERE event = '$pageview' AND ${rangeExpr}
				AND properties.$host IN (${HOST_LIST})
			GROUP BY host, period`,
		overall: `
			SELECT ${periodExpr} AS period,
				count() AS pageviews,
				count(DISTINCT person_id) AS visitors,
				count(DISTINCT properties.$session_id) AS sessions
			FROM events
			WHERE event = '$pageview' AND ${rangeExpr}
				AND properties.$host IN (${HOST_LIST})
			GROUP BY period`,
		events: `
			SELECT event, ${periodExpr} AS period, count() AS hits
			FROM events
			WHERE event IN (${EVENT_LIST}) AND ${rangeExpr}
			GROUP BY event, period`,
		sources: `
			SELECT coalesce(nullIf(properties.$referring_domain, ''), '$direct') AS source,
				count(DISTINCT person_id) AS visitors
			FROM events
			WHERE event = '$pageview' AND ${currentRangeExpr}
				AND properties.$host IN (${HOST_LIST})
			GROUP BY source
			ORDER BY visitors DESC
			LIMIT 6`,
		botSplit: `
			SELECT ${periodExpr} AS period,
				multiIf(
					properties.$virt_traffic_category IN ('ai_crawler','ai_search','ai_assistant'), 'ai',
					properties.$virt_is_bot = true, 'bot',
					'human'
				) AS bucket,
				count() AS hits
			FROM events
			WHERE event = '$pageview' AND ${rangeExpr}
				AND properties.$host IN (${HOST_LIST})
			GROUP BY period, bucket`,
	};
}

export interface TrafficData {
	/** [host, period, pageviews, visitors, sessions] */
	perHost: unknown[][];
	/** [period, pageviews, visitors, sessions] */
	overall: unknown[][];
	/** [event, period, hits] */
	events: unknown[][];
	/** [source, visitors] — current period only */
	sources: unknown[][];
	/** [period, bucket, hits] */
	botSplit: unknown[][];
}

function num(v: unknown): number {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

/** `+12.3%`, `-4.0%`, `new` (from zero), or `–` (still zero). */
export function formatDelta(current: number, previous: number): string {
	if (previous === 0) {
		return current > 0 ? "new" : "–";
	}
	const pct = ((current - previous) / previous) * 100;
	return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

const fmt = (n: number) => n.toLocaleString("en-US");

/** Monospace table: first column left-aligned, the rest right-aligned. */
export function renderTable(headers: string[], rows: string[][]): string {
	const widths = headers.map((h, i) =>
		Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
	);
	const line = (cells: string[]) =>
		cells
			.map((cell, i) =>
				i === 0 ? cell.padEnd(widths[i]!) : cell.padStart(widths[i]!),
			)
			.join("  ")
			.trimEnd();
	return [line(headers), ...rows.map(line)].join("\n");
}

const codeBlock = (body: string) => "```\n" + body + "\n```";

type Totals = { pageviews: number; visitors: number; sessions: number };
const emptyTotals = (): Totals => ({ pageviews: 0, visitors: 0, sessions: 0 });

function productLabel(host: string): string | undefined {
	return PRODUCTS.find((p) => (p.hosts as readonly string[]).includes(host))
		?.label;
}

/** Render the report embed from the raw (positional) HogQL rows. Pure. */
export function buildTrafficEmbed(
	window: ReportWindow,
	data: TrafficData,
): DiscordEmbed {
	// Overview: current vs previous totals.
	const overall: Record<string, Totals> = {};
	for (const row of data.overall) {
		overall[String(row[0])] = {
			pageviews: num(row[1]),
			visitors: num(row[2]),
			sessions: num(row[3]),
		};
	}
	const cur = overall.current ?? emptyTotals();
	const prev = overall.previous ?? emptyTotals();
	const overview = renderTable(
		["Metric", "Now", "Prev", "Δ"],
		(["pageviews", "visitors", "sessions"] as const).map((k) => [
			k,
			fmt(cur[k]),
			fmt(prev[k]),
			formatDelta(cur[k], prev[k]),
		]),
	);

	// Per product, hosts merged by label (www + apex are one product).
	const byProduct = new Map<string, { cur: Totals; prev: Totals }>();
	for (const row of data.perHost) {
		const label = productLabel(String(row[0]));
		if (!label) {
			continue;
		}
		const bucket = byProduct.get(label) ?? {
			cur: emptyTotals(),
			prev: emptyTotals(),
		};
		const side = String(row[1]) === "current" ? bucket.cur : bucket.prev;
		side.pageviews += num(row[2]);
		side.visitors += num(row[3]);
		side.sessions += num(row[4]);
		byProduct.set(label, bucket);
	}
	const products = renderTable(
		["Product", "Views", "Visitors", "Δ"],
		PRODUCTS.map((p) => {
			const t = byProduct.get(p.label) ?? {
				cur: emptyTotals(),
				prev: emptyTotals(),
			};
			return [
				p.label,
				fmt(t.cur.pageviews),
				fmt(t.cur.visitors),
				formatDelta(t.cur.pageviews, t.prev.pageviews),
			];
		}),
	);

	// Key events: current vs previous counts.
	const eventCounts = new Map<string, { cur: number; prev: number }>();
	for (const row of data.events) {
		const key = String(row[0]);
		const bucket = eventCounts.get(key) ?? { cur: 0, prev: 0 };
		if (String(row[1]) === "current") {
			bucket.cur += num(row[2]);
		} else {
			bucket.prev += num(row[2]);
		}
		eventCounts.set(key, bucket);
	}
	const events = renderTable(
		["Event", "Now", "Prev", "Δ"],
		EVENTS.map((e) => {
			const t = eventCounts.get(e.event) ?? { cur: 0, prev: 0 };
			return [e.label, fmt(t.cur), fmt(t.prev), formatDelta(t.cur, t.prev)];
		}),
	);

	// Top sources (current period).
	const sources = renderTable(
		["Source", "Visitors"],
		data.sources.map((row) => [String(row[0]), fmt(num(row[1]))]),
	);

	// Human / bot / AI mix (current period) + automated share.
	const mix: Record<string, number> = { human: 0, bot: 0, ai: 0 };
	for (const row of data.botSplit) {
		if (String(row[0]) === "current") {
			mix[String(row[1])] = (mix[String(row[1])] ?? 0) + num(row[2]);
		}
	}
	const mixTotal = mix.human! + mix.bot! + mix.ai!;
	const automatedShare =
		mixTotal > 0 ? (((mix.bot! + mix.ai!) / mixTotal) * 100).toFixed(1) : "0.0";
	const trafficMix = renderTable(
		["Bucket", "Views"],
		[
			["human", fmt(mix.human!)],
			["bot", fmt(mix.bot!)],
			["ai", fmt(mix.ai!)],
		],
	);

	const description = [
		"**Overview**",
		codeBlock(overview),
		"**By product**",
		codeBlock(products),
		"**Key events**",
		codeBlock(events),
		"**Top sources**",
		codeBlock(sources),
		`**Traffic mix** · ${automatedShare}% automated`,
		codeBlock(trafficMix),
	].join("\n");

	return {
		title: `${window.period === "week" ? "📈 Weekly" : "📊 Monthly"} Traffic Report · ${window.rangeLabel}`,
		description,
		color: window.period === "week" ? 0x6366f1 : 0x8b5cf6,
		footer: { text: "Clanker Support · PostHog analytics" },
		timestamp: new Date().toISOString(),
	};
}

interface PosthogQueryConfig {
	host: string;
	projectId: string;
	apiKey: string;
}

/** POST a HogQLQuery to PostHog's query API; rows come back positional. */
async function runHogql(
	cfg: PosthogQueryConfig,
	query: string,
): Promise<unknown[][]> {
	const res = await fetch(`${cfg.host}/api/projects/${cfg.projectId}/query/`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${cfg.apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	if (!res.ok) {
		throw new Error(
			`PostHog query failed: ${res.status} - ${await res.text()}`,
		);
	}
	const body = (await res.json()) as { results?: unknown[][] };
	return body.results ?? [];
}

/**
 * Run the full report: five HogQL queries in parallel, one Discord embed out.
 * Skips quietly (with a log line) when the PostHog query credentials or the
 * traffic webhook aren't configured; throws on real failures so the Ploy cron
 * execution records them.
 */
export async function runTrafficReport(
	env: Env,
	period: ReportPeriod,
	now = new Date(),
): Promise<void> {
	const {
		POSTHOG_PERSONAL_API_KEY,
		POSTHOG_PROJECT_ID,
		DISCORD_TRAFFIC_NOTIFICATION_URL,
	} = env.vars;
	if (
		!POSTHOG_PERSONAL_API_KEY ||
		!POSTHOG_PROJECT_ID ||
		!DISCORD_TRAFFIC_NOTIFICATION_URL
	) {
		console.log(
			"traffic-report: skipped — POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID and DISCORD_TRAFFIC_NOTIFICATION_URL must all be set",
		);
		return;
	}
	const cfg: PosthogQueryConfig = {
		// The query API lives on the app host (eu.posthog.com for the
		// clankersupport project), NOT the ingest host in POSTHOG_HOST.
		host: env.vars.POSTHOG_QUERY_HOST || "https://eu.posthog.com",
		projectId: POSTHOG_PROJECT_ID,
		apiKey: POSTHOG_PERSONAL_API_KEY,
	};

	const window = buildWindow(period, now);
	const queries = buildQueries(window);
	const [perHost, overall, events, sources, botSplit] = await Promise.all([
		runHogql(cfg, queries.perHost),
		runHogql(cfg, queries.overall),
		runHogql(cfg, queries.events),
		runHogql(cfg, queries.sources),
		runHogql(cfg, queries.botSplit),
	]);

	const embed = buildTrafficEmbed(window, {
		perHost,
		overall,
		events,
		sources,
		botSplit,
	});
	await postDiscordWebhook(DISCORD_TRAFFIC_NOTIFICATION_URL, {
		embeds: [embed],
	});
}
