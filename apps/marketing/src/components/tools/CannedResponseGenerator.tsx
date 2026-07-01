"use client";

import { useState } from "react";
import {
	fieldInput,
	fieldLabel,
	fieldSelect,
	segmentButton,
} from "@/components/tools/field";
import { CopyButton, useToolUsedOnce } from "@/components/tools/CopyButton";

const TOOL = "canned-response-generator";

type Tone = "warm" | "professional" | "brief";

const TONES: { id: Tone; label: string }[] = [
	{ id: "warm", label: "Warm" },
	{ id: "professional", label: "Professional" },
	{ id: "brief", label: "Brief" },
];

interface Vars {
	customer: string;
	company: string;
	agent: string;
	detail: string;
}

interface Scenario {
	id: string;
	label: string;
	detailLabel: string;
	detailDefault: string;
	/** Tone-specific body. The greeting/sign-off are shared per tone. */
	body: (v: Vars, tone: Tone) => string;
}

// The marked line every template keeps: one sentence naming their actual
// situation. Deleting it is what makes a canned response sound canned.
const SPECIFIC = "[one sentence naming their specific situation]";

const SCENARIOS: Scenario[] = [
	{
		id: "refund",
		label: "Refund request",
		detailLabel: "Refund timeframe",
		detailDefault: "5–7 business days",
		body: (v, tone) =>
			tone === "brief"
				? `Your refund is approved and on its way — expect it within ${v.detail}. ${SPECIFIC}`
				: `Thanks for reaching out — I've gone ahead and approved your refund. ${SPECIFIC}\n\nYou'll see the amount back on your original payment method within ${v.detail}. If it hasn't landed by then, reply here and I'll chase it personally.`,
	},
	{
		id: "bug-report",
		label: "Bug report",
		detailLabel: "Expected fix window",
		detailDefault: "the next few days",
		body: (v, tone) =>
			tone === "brief"
				? `Confirmed — that's a bug on our side. ${SPECIFIC} Fix expected within ${v.detail}; I'll update you here the moment it ships.`
				: `Thanks for the detailed report — you're right, and I've reproduced it on our side. ${SPECIFIC}\n\nI've filed it with our engineers and we expect a fix within ${v.detail}. I'll follow up in this thread as soon as it's live, so you don't have to check back.`,
	},
	{
		id: "feature-request",
		label: "Feature request",
		detailLabel: "Where it fits today",
		detailDefault: "our roadmap review this quarter",
		body: (v, tone) =>
			tone === "brief"
				? `Great suggestion — logged. ${SPECIFIC} It's going into ${v.detail}; I'll let you know if it ships.`
				: `That's a genuinely useful idea — thank you. ${SPECIFIC}\n\nI've logged it for ${v.detail} and linked your conversation so the team sees the context first-hand. If it ships, you'll hear it from me first.`,
	},
	{
		id: "outage",
		label: "Outage apology",
		detailLabel: "What happened / status",
		detailDefault: "a database failover that has since been resolved",
		body: (v, tone) =>
			tone === "brief"
				? `We had an outage earlier — ${v.detail}. ${SPECIFIC} Everything is back up; sorry for the disruption.`
				: `First, I'm sorry — we know you rely on ${v.company} and today we let you down. ${SPECIFIC}\n\nThe cause was ${v.detail}. Service is fully restored and we're putting safeguards in place so this specific failure can't repeat. Thank you for bearing with us.`,
	},
	{
		id: "shipping-delay",
		label: "Shipping delay",
		detailLabel: "New delivery estimate",
		detailDefault: "3–5 extra business days",
		body: (v, tone) =>
			tone === "brief"
				? `Your order is delayed — new estimate: ${v.detail}. ${SPECIFIC} We'll email tracking the moment it moves.`
				: `I'm sorry — your order is running behind. ${SPECIFIC}\n\nThe updated estimate is ${v.detail}, and you'll get tracking the moment it leaves the warehouse. If the timing no longer works for you, reply here and we'll sort out an alternative.`,
	},
	{
		id: "account-access",
		label: "Account access / reset",
		detailLabel: "Reset link validity",
		detailDefault: "60 minutes",
		body: (v, tone) =>
			tone === "brief"
				? `Reset link sent — valid for ${v.detail}. ${SPECIFIC} If it doesn't arrive, check spam or reply here.`
				: `No problem — I've just sent a fresh reset link to this address; it's valid for ${v.detail}. ${SPECIFIC}\n\nIf it doesn't arrive in a couple of minutes, check your spam folder — and if it's still missing, reply and I'll verify the account with you another way.`,
	},
	{
		id: "cancellation",
		label: "Cancellation (save attempt)",
		detailLabel: "The alternative to offer",
		detailDefault: "pausing your plan for two months",
		body: (v, tone) =>
			tone === "brief"
				? `Done — no hoops. ${SPECIFIC} If it's timing or cost, ${v.detail} is on the table. Otherwise, you're all set.`
				: `Of course — I've processed that, no hoops to jump through. ${SPECIFIC}\n\nBefore you go: if this is about timing or cost, we could try ${v.detail} instead, so you keep your history and settings. Either way, you're all set, and you're welcome back anytime.`,
	},
	{
		id: "escalation-ack",
		label: "Escalation acknowledgment",
		detailLabel: "Follow-up window",
		detailDefault: "one business day",
		body: (v, tone) =>
			tone === "brief"
				? `Escalated to our senior team. ${SPECIFIC} You'll hear back within ${v.detail}.`
				: `Thanks for your patience — this one needs eyes beyond the first line, so I've escalated it to our senior team with your full history attached. ${SPECIFIC}\n\nYou'll hear back within ${v.detail}. I'm keeping the ticket open on my side until it's resolved.`,
	},
];

function greeting(v: Vars, tone: Tone): string {
	const name = v.customer || "there";
	if (tone === "warm") return `Hi ${name},`;
	if (tone === "professional") return `Hello ${name},`;
	return `Hi ${name} —`;
}

function signoff(v: Vars, tone: Tone): string {
	const agent = v.agent || "The support team";
	const company = v.company ? ` at ${v.company}` : "";
	if (tone === "warm") return `Thanks again,\n${agent}${company}`;
	if (tone === "professional") return `Best regards,\n${agent}${company}`;
	return `— ${agent}`;
}

function buildResponse(s: Scenario, v: Vars, tone: Tone): string {
	return `${greeting(v, tone)}\n\n${s.body(v, tone)}\n\n${signoff(v, tone)}`;
}

/** Scenario + tone + names in, polished plain-text support reply out. */
export function CannedResponseGenerator() {
	const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
	const [tone, setTone] = useState<Tone>("warm");
	const [customer, setCustomer] = useState("Sam");
	const [company, setCompany] = useState("Acme");
	const [agent, setAgent] = useState("Rita");
	const [detail, setDetail] = useState(SCENARIOS[0].detailDefault);
	const used = useToolUsedOnce(TOOL);

	const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
	const vars: Vars = { customer, company, agent, detail };
	const output = buildResponse(scenario, vars, tone);

	return (
		<div className="grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule lg:grid-cols-[1fr_1.15fr]">
			{/* ── Controls ───────────────────────────────────────── */}
			<div className="bg-paper-card p-7 sm:p-8">
				<p className="kicker">Build your reply</p>

				<div className="mt-6 space-y-5">
					<label className="block">
						<span className={fieldLabel}>Scenario</span>
						<select
							value={scenarioId}
							onChange={(e) => {
								used();
								setScenarioId(e.target.value);
								const next = SCENARIOS.find((s) => s.id === e.target.value);
								if (next) setDetail(next.detailDefault);
							}}
							className={fieldSelect}
						>
							{SCENARIOS.map((s) => (
								<option key={s.id} value={s.id}>
									{s.label}
								</option>
							))}
						</select>
					</label>

					<div>
						<span className={fieldLabel}>Tone</span>
						<div className="mt-2 flex flex-wrap gap-2">
							{TONES.map((t) => (
								<button
									key={t.id}
									type="button"
									onClick={() => {
										used();
										setTone(t.id);
									}}
									className={segmentButton(tone === t.id)}
								>
									{t.label}
								</button>
							))}
						</div>
					</div>

					<div className="grid gap-5 sm:grid-cols-2">
						<label className="block">
							<span className={fieldLabel}>Customer's first name</span>
							<input
								value={customer}
								onChange={(e) => {
									used();
									setCustomer(e.target.value);
								}}
								className={fieldInput}
							/>
						</label>
						<label className="block">
							<span className={fieldLabel}>Your name</span>
							<input
								value={agent}
								onChange={(e) => {
									used();
									setAgent(e.target.value);
								}}
								className={fieldInput}
							/>
						</label>
					</div>

					<label className="block">
						<span className={fieldLabel}>Company / product</span>
						<input
							value={company}
							onChange={(e) => {
								used();
								setCompany(e.target.value);
							}}
							className={fieldInput}
						/>
					</label>

					<label className="block">
						<span className={fieldLabel}>{scenario.detailLabel}</span>
						<input
							value={detail}
							onChange={(e) => {
								used();
								setDetail(e.target.value);
							}}
							className={fieldInput}
						/>
					</label>
				</div>
			</div>

			{/* ── Output ─────────────────────────────────────────── */}
			<div className="relative flex flex-col overflow-hidden bg-paper p-7 sm:p-8">
				<div className="grid-backdrop pointer-events-none absolute inset-0" />
				<div className="relative flex flex-1 flex-col">
					<div className="flex items-center justify-between gap-4">
						<p className="kicker">Your reply</p>
						<CopyButton text={() => output} tool={TOOL} label="Copy reply" />
					</div>

					<pre className="mt-6 flex-1 whitespace-pre-wrap rounded-2xl border border-rule bg-paper-card/60 p-6 font-sans text-[0.95rem] leading-relaxed text-ink-soft">
						{output}
					</pre>

					<p className="mt-4 text-xs leading-relaxed text-muted">
						The bracketed line is deliberate — replace it with one sentence
						about their actual message. That single sentence is what makes a
						template read like a person.
					</p>
				</div>
			</div>
		</div>
	);
}
