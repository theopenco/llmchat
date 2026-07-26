"use client";

import { useEffect, useRef, useState } from "react";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";

/**
 * The hero demo: a scripted, clickable rehearsal of the product's whole
 * argument — docs-grounded answers for the repeats, an honest hand-off for the
 * rest. The escalation beat mirrors the real mechanics exactly: the agent
 * OFFERS a human, the widget surfaces [Talk to a human], and the VISITOR taps
 * it — the agent never escalates on its own, so the demo must not either
 * (homepage claim-check, 2026-07-26). No backend, no signup, nothing leaves
 * the page; the real widget (bottom-right) is one click away for the skeptics.
 *
 * Auto-plays the escalation script once when scrolled into view, then lets the
 * visitor click the other questions. Respects prefers-reduced-motion by
 * rendering final states instantly.
 */

type Script = {
	id: string;
	q: string;
	a: string;
	escalates?: boolean;
	human?: string;
};

const SCRIPTS: Script[] = [
	{
		id: "refund",
		q: "Can I get a refund 45 days after purchase?",
		a: "Our refund policy covers 30 days, and I don't see a documented exception for day 45 — I won't guess on this one. Want me to bring in a human?",
		escalates: true,
		human:
			"Hi — Priya from support. I've read the thread above, so you don't need to repeat anything. Let's sort your refund out.",
	},
	{
		id: "order",
		q: "Where's my order?",
		a: "Orders ship within 24 hours and tracking lands in your inbox the moment the label prints. Lost the email? Your account's Orders page has a “Resend tracking” button.",
	},
	{
		id: "nextjs",
		q: "Do you support Next.js?",
		a: "Yes — install the official server component with `npm i @clankersupport/widget-rsc`, drop it in your root layout, and the widget ships with your app.",
	},
];

// Playback phases, in order. Each script walks the prefix it needs; the
// escalation script alone continues past "answered": the hand-off is offered,
// the visitor taps, and only then does the thread escalate.
type Phase =
	| "idle"
	| "asked"
	| "thinking"
	| "answering"
	| "answered"
	| "offered"
	| "tapped"
	| "escalated"
	| "human-typing"
	| "resolved";

const TYPE_MS = 14;

export function InlineDemo() {
	const [script, setScript] = useState<Script>(SCRIPTS[0]);
	const [phase, setPhase] = useState<Phase>("idle");
	const [typed, setTyped] = useState("");
	const rootRef = useRef<HTMLDivElement | null>(null);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const startedRef = useRef(false);

	const clearTimers = () => {
		timers.current.forEach(clearTimeout);
		timers.current = [];
	};
	const later = (fn: () => void, ms: number) => {
		timers.current.push(setTimeout(fn, ms));
	};

	const reducedMotion = () =>
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const play = (s: Script) => {
		clearTimers();
		setScript(s);
		setTyped("");
		if (reducedMotion()) {
			setPhase(s.escalates ? "resolved" : "answered");
			setTyped(s.a);
			return;
		}
		setPhase("asked");
		later(() => setPhase("thinking"), 500);
		later(() => {
			setPhase("answering");
			let i = 0;
			const tick = () => {
				i += 2;
				setTyped(s.a.slice(0, i));
				if (i < s.a.length) {
					timers.current.push(setTimeout(tick, TYPE_MS));
				} else {
					setPhase("answered");
					if (s.escalates) {
						later(() => setPhase("offered"), 600);
						later(() => setPhase("tapped"), 1800);
						later(() => setPhase("escalated"), 2500);
						later(() => setPhase("human-typing"), 3400);
						later(() => setPhase("resolved"), 4600);
					}
				}
			};
			tick();
		}, 1400);
	};

	// Auto-play the escalation story once, when the card first becomes visible.
	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting) && !startedRef.current) {
					startedRef.current = true;
					play(SCRIPTS[0]);
					io.disconnect();
				}
			},
			{ threshold: 0.4 },
		);
		io.observe(el);
		return () => {
			io.disconnect();
			clearTimers();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const pick = (s: Script) => {
		track(ANALYTICS_EVENTS.ctaClicked, {
			label: "inline_demo_question",
			location: "home_hero",
			question: s.id,
		});
		startedRef.current = true;
		play(s);
	};

	const showAnswer =
		phase === "answering" ||
		phase === "answered" ||
		phase === "offered" ||
		phase === "tapped" ||
		phase === "escalated" ||
		phase === "human-typing" ||
		phase === "resolved";

	return (
		<div ref={rootRef} className="relative">
			<div className="overflow-hidden rounded-3xl border border-rule bg-paper-card shadow-lift">
				{/* Header */}
				<div className="flex items-center gap-3 border-b border-rule-soft px-5 py-4">
					<div className="flex size-9 items-center justify-center gap-1 rounded-xl bg-ink">
						<span className="size-1.5 rounded-full bg-accent" />
						<span className="size-1.5 rounded-full bg-accent" />
					</div>
					<div className="flex-1">
						<div className="font-display text-base font-semibold text-ink">
							Support
						</div>
						<div className="font-mono text-[0.65rem] text-accent-soft">
							● powered by Clanker
						</div>
					</div>
					<span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-accent-soft">
						Demo — click a question
					</span>
				</div>

				{/* Conversation */}
				<div
					className="flex min-h-[19rem] flex-col gap-3 bg-paper-deep/40 p-5"
					aria-live="polite"
				>
					{phase !== "idle" && (
						<div className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[0.9rem] leading-snug text-paper">
							{script.q}
						</div>
					)}

					{phase === "thinking" && <TypingDots label="Clanker is reading" />}

					{showAnswer && (
						<div className="max-w-[88%] self-start">
							<div className="rounded-2xl rounded-bl-md bg-paper-raise px-4 py-2.5 text-[0.9rem] leading-snug text-ink-soft">
								{typed}
							</div>
							{!script.escalates &&
								(phase === "answered" || phase === "resolved") && (
									<div
										aria-hidden
										className="mt-1.5 pl-1 font-mono text-[0.62rem] tracking-wider text-faint"
									>
										👍 👎
									</div>
								)}
						</div>
					)}

					{/* The hand-off, as it actually works: the widget surfaces the
					    button, and the VISITOR taps it. Decorative — the ripple dot is
					    the scripted visitor's tap. */}
					{(phase === "offered" || phase === "tapped") && (
						<div aria-hidden className="relative self-start pl-1">
							<span
								className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[0.8rem] font-medium transition-all duration-200 ${
									phase === "tapped"
										? "scale-95 border-accent bg-accent/15 text-accent"
										: "animate-rise-in border-accent/50 bg-paper-card text-accent-soft"
								}`}
							>
								Talk to a human
							</span>
							{phase === "tapped" && (
								<span className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-ping rounded-full bg-accent/40 ring-2 ring-accent/60" />
							)}
						</div>
					)}

					{(phase === "escalated" ||
						phase === "human-typing" ||
						phase === "resolved") && (
						<div className="my-1 inline-flex items-center gap-2 self-center rounded-full bg-accent/10 px-3.5 py-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-accent-soft">
							↗ Escalated — full thread attached
						</div>
					)}

					{phase === "human-typing" && <TypingDots label="Priya is typing" />}

					{phase === "resolved" && script.human && (
						<div className="flex max-w-[90%] gap-2.5 self-start">
							<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[0.8rem] font-bold text-white">
								P
							</div>
							<div className="rounded-2xl rounded-bl-md bg-paper-raise px-4 py-2.5 text-[0.9rem] leading-snug text-ink-soft">
								{script.human}
							</div>
						</div>
					)}
				</div>

				{/* Question picker — the composer of the demo */}
				<div className="border-t border-rule-soft p-4">
					<p className="px-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">
						Ask it
					</p>
					<div className="mt-2 flex flex-wrap gap-2">
						{SCRIPTS.map((s) => (
							<button
								key={s.id}
								type="button"
								onClick={() => pick(s)}
								className={`rounded-full border px-3.5 py-2 text-left text-[0.8rem] font-medium transition-colors ${
									script.id === s.id && phase !== "idle"
										? "border-accent/50 bg-accent/10 text-ink"
										: "border-rule bg-paper-card text-ink-soft hover:border-accent/40 hover:text-ink"
								}`}
							>
								{s.q}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Annotation — ties the demo to the thesis */}
			<p className="mt-4 text-center font-mono text-[0.65rem] uppercase tracking-[0.14em] text-faint lg:text-left">
				Scripted rehearsal — the real one is bottom-right on this page
			</p>
		</div>
	);
}

function TypingDots({ label }: { label: string }) {
	return (
		<div
			className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md bg-paper-raise px-4 py-3"
			aria-label={label}
		>
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					className="size-1.5 animate-pulse rounded-full bg-muted"
					style={{ animationDelay: `${i * 160}ms` }}
				/>
			))}
		</div>
	);
}
