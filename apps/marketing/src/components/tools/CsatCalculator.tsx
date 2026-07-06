"use client";

import { useState } from "react";
import { fieldInput, fieldLabel } from "@/components/tools/field";
import { useToolUsedOnce } from "@/components/tools/CopyButton";

const TOOL = "csat-calculator";

/** Published industry averages (ACSI-style ranges), used as visual anchors. */
const BENCHMARKS: { label: string; score: number }[] = [
	{ label: "Software / SaaS", score: 81 },
	{ label: "Ecommerce & retail", score: 84 },
	{ label: "Financial services", score: 78 },
	{ label: "Telecom & utilities", score: 73 },
];

function band(score: number): { label: string; tone: string } {
	if (score >= 90) return { label: "Exceptional", tone: "text-accent-soft" };
	if (score >= 80) return { label: "Strong", tone: "text-ink" };
	if (score >= 70) return { label: "Average", tone: "text-muted" };
	return { label: "Needs attention", tone: "text-muted" };
}

function clampInt(raw: string, max: number): number {
	const n = Math.floor(Number(raw.replace(/[^0-9]/g, "")));
	if (!Number.isFinite(n) || n < 0) return 0;
	return Math.min(n, max);
}

/** CSAT = satisfied (4–5) ÷ total × 100, with benchmarks and a sample-size note. */
export function CsatCalculator() {
	const [satisfied, setSatisfied] = useState(83);
	const [total, setTotal] = useState(100);
	const used = useToolUsedOnce(TOOL);

	const valid = total > 0 && satisfied <= total;
	const score = valid ? (satisfied / total) * 100 : null;
	const rounded = score === null ? null : Math.round(score * 10) / 10;
	const scoreBand = rounded === null ? null : band(rounded);

	return (
		<div className="grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule lg:grid-cols-[1fr_1.15fr]">
			{/* ── Inputs ─────────────────────────────────────────── */}
			<div className="bg-paper-card p-7 sm:p-8">
				<p className="kicker">Your survey results</p>

				<div className="mt-6 space-y-5">
					<label className="block">
						<span className={fieldLabel}>
							Satisfied responses (rated 4 or 5)
						</span>
						<input
							type="text"
							inputMode="numeric"
							value={satisfied}
							onChange={(e) => {
								used();
								setSatisfied(clampInt(e.target.value, 10_000_000));
							}}
							className={fieldInput}
						/>
					</label>

					<label className="block">
						<span className={fieldLabel}>Total survey responses</span>
						<input
							type="text"
							inputMode="numeric"
							value={total}
							onChange={(e) => {
								used();
								setTotal(clampInt(e.target.value, 10_000_000));
							}}
							className={fieldInput}
						/>
					</label>
				</div>

				{/* The formula, made visible — the page targets "how is CSAT calculated". */}
				<div className="mt-8 rounded-2xl border border-rule bg-paper p-5">
					<p className={fieldLabel}>The formula</p>
					<p className="mt-3 font-mono text-sm leading-relaxed text-ink-soft">
						({satisfied.toLocaleString()} ÷ {total.toLocaleString()}) × 100 ={" "}
						<span className="font-semibold text-accent-soft">
							{rounded === null ? "—" : `${rounded}%`}
						</span>
					</p>
				</div>

				{!valid && (
					<p className="mt-4 text-sm text-muted">
						Satisfied responses can't exceed total responses.
					</p>
				)}
				{valid && total > 0 && total < 30 && (
					<p className="mt-4 text-sm leading-relaxed text-muted">
						Under 30 responses, treat the score as directional — one rating
						swings it by {Math.round(1000 / total) / 10} points.
					</p>
				)}
			</div>

			{/* ── Score + benchmarks ─────────────────────────────── */}
			<div className="relative overflow-hidden bg-paper p-7 sm:p-8">
				<div className="grid-backdrop pointer-events-none absolute inset-0" />
				<div className="relative">
					<p className="kicker">Your CSAT score</p>

					<div className="mt-4 flex items-baseline gap-4">
						<span className="font-display text-7xl font-semibold tabular-nums tracking-tight-display text-ink">
							{rounded === null ? "—" : `${rounded}%`}
						</span>
						{scoreBand && (
							<span
								className={`font-mono text-[0.72rem] uppercase tracking-[0.16em] ${scoreBand.tone}`}
							>
								{scoreBand.label}
							</span>
						)}
					</div>

					<div className="mt-8 space-y-4">
						<p className={fieldLabel}>vs. industry averages</p>
						{BENCHMARKS.map((b) => (
							<div key={b.label}>
								<div className="flex items-baseline justify-between text-sm">
									<span className="text-ink-soft">{b.label}</span>
									<span className="font-mono text-xs tabular-nums text-faint">
										{b.score}%
									</span>
								</div>
								<div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-rule">
									<div
										className="h-full rounded-full bg-faint/50"
										style={{ width: `${b.score}%` }}
									/>
									{rounded !== null && (
										<div
											aria-hidden
											className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-accent shadow-[0_0_8px_2px_rgba(46,107,255,0.5)]"
											style={{ left: `${Math.min(rounded, 100)}%` }}
										/>
									)}
								</div>
							</div>
						))}
						<p className="pt-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-faint">
							● your score, plotted against each average
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
