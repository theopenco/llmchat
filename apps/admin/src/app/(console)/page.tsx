"use client";

import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { PageHeader, Panel } from "@/components/Page";
import { PlanBreakdown } from "@/components/PlanBreakdown";
import { StatCard } from "@/components/StatCard";
import {
	fmtCompact,
	fmtDate,
	fmtInt,
	fmtUsd,
	fmtUsdPrecise,
} from "@/lib/format";
import { useOverview } from "@/lib/hooks";

export default function OverviewPage() {
	const { data, isLoading, isError, refetch } = useOverview();

	return (
		<>
			<PageHeader
				title="Overview"
				subtitle="Signups, revenue, and platform activity across all workspaces."
				right={
					<button
						type="button"
						onClick={() => refetch()}
						className="rounded-md border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:bg-raise hover:text-text"
					>
						Refresh
					</button>
				}
			/>

			<div className="flex flex-col gap-6 px-6 py-6 md:px-8">
				{isError ? (
					<Panel>
						<p className="text-sm text-neg">
							Couldn&apos;t load metrics. Try refreshing.
						</p>
					</Panel>
				) : isLoading || !data ? (
					<LoadingGrid />
				) : (
					<>
						{/* Headline metrics */}
						<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
							<StatCard
								label="Total signups"
								value={fmtInt(data.users.total)}
								hint={`+${fmtInt(data.users.new7d)} in 7d · +${fmtInt(
									data.users.new24h,
								)} today`}
							/>
							<StatCard
								label="Active subscriptions"
								value={fmtInt(data.subscriptions.activePaid)}
								hint={`${fmtInt(data.content.workspaces)} workspaces total`}
								accent="accent"
							/>
							<StatCard
								label="Est. MRR"
								value={fmtUsd(data.subscriptions.estMrrUsd)}
								hint={`~${fmtUsd(data.subscriptions.estArrUsd)} ARR (estimated)`}
								accent="pos"
							/>
							<StatCard
								label="AI responses · 30d"
								value={fmtCompact(data.usage.responses30d)}
								hint={`${fmtUsdPrecise(data.usage.costUsd30d)} inference cost`}
							/>
						</div>

						{/* Trends */}
						<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
							<Panel
								title="New signups · 30d"
								right={
									<span className="num text-sm text-muted">
										+{fmtInt(data.users.new30d)}
									</span>
								}
							>
								<AreaChart
									values={data.signupsSeries.map((p) => p.count)}
									colorClass="text-accent-soft"
								/>
								<SeriesAxis series={data.signupsSeries.map((p) => p.date)} />
							</Panel>

							<Panel
								title="AI responses · 30d"
								right={
									<span className="num text-sm text-muted">
										{fmtCompact(data.usage.responses30d)}
									</span>
								}
							>
								<BarChart
									values={data.usageSeries.map((p) => p.responses)}
									labels={data.usageSeries.map((p) => p.date)}
									colorClass="text-pos"
								/>
								<SeriesAxis series={data.usageSeries.map((p) => p.date)} />
							</Panel>
						</div>

						{/* Subscriptions + recent signups */}
						<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
							<Panel
								title="Subscriptions by plan"
								right={
									<span className="num text-sm text-pos">
										{fmtUsd(data.subscriptions.estMrrUsd)}/mo
									</span>
								}
							>
								<PlanBreakdown byPlan={data.subscriptions.byPlan} />
							</Panel>

							<Panel title="Recent signups">
								<ul className="flex flex-col divide-y divide-line">
									{data.recentUsers.length === 0 ? (
										<li className="py-2 text-sm text-faint">No signups yet.</li>
									) : (
										data.recentUsers.map((u) => (
											<li
												key={u.id}
												className="flex items-center justify-between gap-3 py-2.5"
											>
												<div className="min-w-0">
													<div className="truncate text-sm text-text">
														{u.name || "—"}
													</div>
													<div className="truncate text-xs text-muted">
														{u.email}
													</div>
												</div>
												<div className="num shrink-0 text-xs text-faint">
													{fmtDate(u.createdAt)}
												</div>
											</li>
										))
									)}
								</ul>
							</Panel>
						</div>

						{/* Platform totals */}
						<Panel title="Platform totals">
							<div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
								<Totline
									label="Workspaces"
									value={fmtInt(data.content.workspaces)}
								/>
								<Totline
									label="Projects"
									value={fmtInt(data.content.projects)}
								/>
								<Totline
									label="Conversations"
									value={fmtInt(data.content.conversations)}
								/>
								<Totline
									label="Messages"
									value={fmtInt(data.content.messages)}
								/>
								<Totline
									label="AI responses (all-time)"
									value={fmtInt(data.usage.responsesTotal)}
								/>
								<Totline
									label="Tokens (all-time)"
									value={fmtCompact(data.usage.tokensTotal)}
								/>
								<Totline
									label="Inference cost (all-time)"
									value={fmtUsdPrecise(data.usage.costUsdTotal)}
								/>
								<Totline
									label="Signups · 30d"
									value={fmtInt(data.users.new30d)}
								/>
							</div>
						</Panel>
					</>
				)}
			</div>
		</>
	);
}

/** First / last day labels under a 30-day chart. */
function SeriesAxis({ series }: { series: string[] }) {
	if (series.length === 0) return null;
	return (
		<div className="mt-2 flex justify-between">
			<span className="label !tracking-normal">{shortDay(series[0])}</span>
			<span className="label !tracking-normal">
				{shortDay(series[series.length - 1])}
			</span>
		</div>
	);
}

function shortDay(dayKey: string): string {
	// `YYYY-MM-DD` → `MM-DD`
	return dayKey.slice(5);
}

function Totline({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="label">{label}</span>
			<span className="num text-lg font-semibold">{value}</span>
		</div>
	);
}

function LoadingGrid() {
	return (
		<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="card h-28 animate-pulse p-5">
					<div className="h-3 w-16 rounded bg-raise" />
					<div className="mt-4 h-7 w-24 rounded bg-raise" />
				</div>
			))}
		</div>
	);
}
