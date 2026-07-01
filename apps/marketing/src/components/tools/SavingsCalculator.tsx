"use client";

import { useState } from "react";
import { BILLING_TIERS } from "@llmchat/shared";
import { fieldInput, fieldLabel } from "@/components/tools/field";
import { useToolUsedOnce } from "@/components/tools/CopyButton";

const TOOL = "support-roi-calculator";

const starterPrice = BILLING_TIERS.starter.priceUsdMonthly;

const usd = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Clamp a free-typed number input to a sane range (empty → 0). */
function clamp(raw: string, max: number): number {
	const n = Number(raw.replace(/[^0-9.]/g, ""));
	if (!Number.isFinite(n) || n < 0) return 0;
	return Math.min(n, max);
}

/**
 * The AI support savings calculator. Pure client-side arithmetic, live
 * results: saved dollars = conversations × deflection × (minutes/60) × hourly.
 */
export function SavingsCalculator() {
	const [conversations, setConversations] = useState(500);
	const [minutes, setMinutes] = useState(8);
	const [hourly, setHourly] = useState(30);
	const [deflection, setDeflection] = useState(60);
	const used = useToolUsedOnce(TOOL);

	const totalHours = (conversations * minutes) / 60;
	const savedHours = totalHours * (deflection / 100);
	const savedMonthly = savedHours * hourly;
	const savedYearly = savedMonthly * 12;
	const humanHours = totalHours - savedHours;
	const starterMultiple = savedMonthly / starterPrice;

	const stats: { label: string; value: string; hint: string }[] = [
		{
			label: "Hours back / month",
			value: `${num.format(Math.round(savedHours))}h`,
			hint: `of ${num.format(Math.round(totalHours))}h your team spends today`,
		},
		{
			label: "Saved / month",
			value: usd.format(savedMonthly),
			hint: `at ${usd.format(hourly)}/hour, fully loaded`,
		},
		{
			label: "Saved / year",
			value: usd.format(savedYearly),
			hint: "same volume, twelve months",
		},
		{
			label: "Left for humans",
			value: `${num.format(Math.round(humanHours))}h`,
			hint: "the conversations that need judgment",
		},
	];

	return (
		<div className="grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule lg:grid-cols-[1fr_1.15fr]">
			{/* ── Inputs ─────────────────────────────────────────── */}
			<div className="bg-paper-card p-7 sm:p-8">
				<p className="kicker">Your support today</p>

				<div className="mt-6 space-y-5">
					<label className="block">
						<span className={fieldLabel}>Conversations per month</span>
						<input
							type="text"
							inputMode="numeric"
							value={num.format(conversations)}
							onChange={(e) => {
								used();
								setConversations(
									clamp(e.target.value.replace(/,/g, ""), 1_000_000),
								);
							}}
							className={fieldInput}
						/>
					</label>

					<label className="block">
						<span className={fieldLabel}>Average minutes per conversation</span>
						<input
							type="text"
							inputMode="numeric"
							value={minutes}
							onChange={(e) => {
								used();
								setMinutes(clamp(e.target.value, 600));
							}}
							className={fieldInput}
						/>
					</label>

					<label className="block">
						<span className={fieldLabel}>Hourly cost of support (USD)</span>
						<input
							type="text"
							inputMode="numeric"
							value={hourly}
							onChange={(e) => {
								used();
								setHourly(clamp(e.target.value, 10_000));
							}}
							className={fieldInput}
						/>
					</label>

					<div>
						<div className="flex items-baseline justify-between">
							<span className={fieldLabel}>AI deflection rate</span>
							<span className="font-mono text-sm font-semibold tabular-nums text-accent-soft">
								{deflection}%
							</span>
						</div>
						<input
							type="range"
							min={10}
							max={90}
							step={5}
							value={deflection}
							aria-label="AI deflection rate (%)"
							onChange={(e) => {
								used();
								setDeflection(Number(e.target.value));
							}}
							className="tool-range mt-3"
							style={
								{
									"--fill": `${((deflection - 10) / 80) * 100}%`,
								} as React.CSSProperties
							}
						/>
						<div className="mt-2 flex justify-between font-mono text-[0.62rem] uppercase tracking-[0.12em] text-faint">
							<span>10% · cautious</span>
							<span>60% · typical</span>
							<span>90% · mature</span>
						</div>
					</div>
				</div>
			</div>

			{/* ── Live results ───────────────────────────────────── */}
			<div className="relative overflow-hidden bg-paper p-7 sm:p-8">
				<div className="grid-backdrop pointer-events-none absolute inset-0" />
				<span
					aria-hidden
					className="pointer-events-none absolute -right-4 -top-10 select-none font-display text-[11rem] font-bold leading-none text-rule/60"
				>
					$
				</span>

				<div className="relative">
					<p className="kicker">With an AI support agent</p>

					<div className="mt-6 grid gap-6 sm:grid-cols-2">
						{stats.map((s) => (
							<div key={s.label}>
								<p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-faint">
									{s.label}
								</p>
								<p className="font-display mt-1.5 text-4xl font-semibold tabular-nums tracking-tight-display text-ink">
									{s.value}
								</p>
								<p className="mt-1 text-xs leading-relaxed text-muted">
									{s.hint}
								</p>
							</div>
						))}
					</div>

					<p className="mt-8 border-t border-rule pt-5 text-sm leading-relaxed text-muted">
						{savedMonthly >= starterPrice ? (
							<>
								That's{" "}
								<strong className="font-semibold text-ink">
									{starterMultiple >= 10
										? `${num.format(Math.round(starterMultiple))}×`
										: `${starterMultiple.toFixed(1)}×`}
								</strong>{" "}
								the ${starterPrice}/mo Starter plan — the agent pays for itself{" "}
								{starterMultiple >= 2 ? "many times over" : "from month one"}.
							</>
						) : (
							<>
								At this volume the numbers are small — but so is the cost:
								hosted plans start at ${starterPrice}/mo, and self-hosting the
								open-source version is free.
							</>
						)}
					</p>
				</div>
			</div>
		</div>
	);
}
