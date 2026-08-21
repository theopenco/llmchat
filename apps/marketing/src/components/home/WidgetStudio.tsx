"use client";

import { useEffect, useRef, useState } from "react";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";

/**
 * An interactive rehearsal of the dashboard's Widget studio: every control
 * here exists for real in Settings → Widget (brand color, agent photo,
 * welcome message, suggested questions, light/dark theme; voice is the
 * Scale-plan entitlement), and the preview mirrors the shipped widget's
 * anatomy — same surface palette as packages/widget/src/styles.ts, same
 * contrast-derived on-brand foreground as packages/widget/src/contrast.ts,
 * same voice-call screen (orb, status labels, mute/end). Nothing here is
 * invented UI.
 *
 * The conversation is SCRIPTED — no backend, nothing leaves the page — and
 * the fallback answer says so; the real widget (bottom-right of this page)
 * is the proof.
 */

const SWATCHES = [
	{ name: "Ink", value: "#111827" },
	{ name: "Indigo", value: "#6366f1" },
	{ name: "Ember", value: "#ea580c" },
	{ name: "Emerald", value: "#059669" },
	{ name: "Blue", value: "#2563eb" },
	{ name: "Rose", value: "#e11d48" },
];

const FACES = [
	{ id: "maya", label: "Maya", src: "/studio/avatar-1.png" },
	{ id: "sam", label: "Sam", src: "/studio/avatar-2.png" },
	{ id: "rana", label: "Rana", src: "/studio/avatar-3.png" },
];

const CHIP_PRESETS = [
	"What's your refund policy?",
	"Do you ship to Canada?",
	"How do I reset my password?",
];

// Scripted answers for the fictional store persona — the same standard as the
// hero demo (annotated as a rehearsal). Anything unmatched gets the honest
// fallback that points at the real widget.
const ANSWERS: { match: RegExp; text: string }[] = [
	{
		match: /refund|return|money.?back/i,
		text: "Unused items can be returned within 30 days of delivery for a full refund. Opened consumables are non-refundable, and refunds land back on the original payment method within 5 business days.",
	},
	{
		match: /ship|canada|deliver/i,
		text: "Yes — we ship to Canada and the EU. Orders leave the warehouse within 24 hours, and tracking lands in your inbox the moment the label prints.",
	},
	{
		match: /password|reset|log.?in/i,
		text: "Head to Account → Security and hit “Reset password” — the link is valid for 30 minutes. Lost access to your account email? Ask here and a human will verify you.",
	},
];
const FALLBACK =
	"Good question — this preview is scripted, so I'll level with you: on your own site I answer from your docs, sources, and Q&A. Tap a suggested question here, or ask the real widget in the corner of this page.";

// The widget's own light/dark surfaces, verbatim from styles.ts — the
// preview must not drift from the product.
const WIDGET_THEME = {
	light: {
		sf: "#ffffff",
		sf2: "#f3f4f6",
		tx: "#111827",
		tx2: "#374151",
		tx5: "#9ca3af",
		ln: "#e5e7eb",
	},
	dark: {
		sf: "#111827",
		sf2: "#1f2937",
		tx: "#f9fafb",
		tx2: "#d1d5db",
		tx5: "#6b7280",
		ln: "#374151",
	},
};

const TYPE_MS = 14;

/** Hex-only port of the widget's onBrandForeground (contrast.ts): pick
 * white or ink by WCAG contrast against the brand, ties to white. */
function onBrandForeground(hex: string): string {
	const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return "#fff";
	const channel = (i: number) => {
		const s = Number.parseInt(m[1].slice(i, i + 2), 16) / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	const lum = (r: number, g: number, b: number) =>
		0.2126 * r + 0.7152 * g + 0.0722 * b;
	const brand = lum(channel(0), channel(2), channel(4));
	// ink #111827 luminance ≈ 0.0106; white = 1.
	const vsInk = (brand + 0.05) / (0.0106 + 0.05);
	const vsWhite = (1 + 0.05) / (brand + 0.05);
	return vsInk > vsWhite ? "#111827" : "#fff";
}

function answerFor(text: string): string {
	return ANSWERS.find((a) => a.match.test(text))?.text ?? FALLBACK;
}

function Sparkle({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" className={className}>
			<path d="M12 2.5c.4 3.9 1.7 6.6 3.4 8.1 1.6 1.4 3.7 2 6.1 2.4-2.4.4-4.5 1-6.1 2.4-1.7 1.5-3 4.2-3.4 8.1-.4-3.9-1.7-6.6-3.4-8.1-1.6-1.4-3.7-2-6.1-2.4 2.4-.4 4.5-1 6.1-2.4 1.7-1.5 3-4.2 3.4-8.1Z" />
		</svg>
	);
}

function Stroke({ d, className }: { d: string; className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden
		>
			<path d={d} />
		</svg>
	);
}

const PHONE_D =
	"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z";
const MIC_D =
	"M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v4";
const MIC_OFF_D =
	"M2 2l20 20M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7M19 11a7 7 0 0 1-.6 2.8M5 11a7 7 0 0 0 9.4 6.6M12 18v4";
const COMPOSE_D =
	"M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z";
const CLOSE_D = "M6 6l12 12M18 6L6 18";
const EXPAND_D =
	"M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3";
const SEND_D = "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z";

type Msg = { id: number; role: "user" | "assistant" | "note"; text: string };
type CallStatus = "connecting" | "listening" | "speaking";
// Mirrors the widget's STATUS_LABEL for the states the rehearsal can reach.
const CALL_LABEL: Record<CallStatus, string> = {
	connecting: "Connecting…",
	listening: "Listening…",
	speaking: "Speaking…",
};

export function WidgetStudio() {
	const [color, setColor] = useState("#ea580c");
	const [face, setFace] = useState<string | null>(FACES[0].src);
	const [welcome, setWelcome] = useState("Hi! How can I help you today?");
	const [chips, setChips] = useState<string[]>(CHIP_PRESETS.slice(0, 2));
	const [theme, setTheme] = useState<"light" | "dark">("light");
	const [voiceOn, setVoiceOn] = useState(true);
	const [open, setOpen] = useState(true);
	const [expanded, setExpanded] = useState(false);

	// Scripted conversation state.
	const [messages, setMessages] = useState<Msg[]>([]);
	const [typing, setTyping] = useState(false);
	const [stream, setStream] = useState<string | null>(null);
	const [draft, setDraft] = useState("");
	const [rated, setRated] = useState<Record<number, "up" | "down">>({});
	const nextId = useRef(1);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const scrollRef = useRef<HTMLDivElement | null>(null);

	// Voice-call rehearsal state.
	const [inCall, setInCall] = useState(false);
	const [callStatus, setCallStatus] = useState<CallStatus>("connecting");
	const [callSec, setCallSec] = useState(0);
	const [muted, setMuted] = useState(false);

	const t = WIDGET_THEME[theme];
	const fg = onBrandForeground(color);
	const busy = typing || stream !== null;
	const hasUserMessage = messages.some((m) => m.role === "user");

	const touch = (control: string) =>
		track(ANALYTICS_EVENTS.ctaClicked, {
			label: "widget_studio",
			location: "home_studio",
			control,
		});

	const later = (fn: () => void, ms: number) => {
		timers.current.push(setTimeout(fn, ms));
	};
	// Clear pending typewriter/typing timers on unmount.
	useEffect(
		() => () => {
			timers.current.forEach(clearTimeout);
		},
		[],
	);

	// Keep the newest message in view as the conversation grows.
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages, typing, stream, inCall]);

	// The call ticks: seconds counter, connect → listening, then the
	// listening/speaking alternation the real orb animates through.
	useEffect(() => {
		if (!inCall) return;
		const tick = setInterval(() => setCallSec((s) => s + 1), 1000);
		const connected = setTimeout(() => setCallStatus("listening"), 1400);
		const alternate = setInterval(
			() => setCallStatus((s) => (s === "speaking" ? "listening" : "speaking")),
			2600,
		);
		return () => {
			clearInterval(tick);
			clearTimeout(connected);
			clearInterval(alternate);
		};
	}, [inCall]);

	const reducedMotion = () =>
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	function send(text: string) {
		const q = text.trim();
		if (!q || busy || inCall) return;
		touch("chat");
		setDraft("");
		setMessages((m) => [...m, { id: nextId.current++, role: "user", text: q }]);
		setTyping(true);
		const answer = answerFor(q);
		later(() => {
			setTyping(false);
			if (reducedMotion()) {
				setMessages((m) => [
					...m,
					{ id: nextId.current++, role: "assistant", text: answer },
				]);
				return;
			}
			let i = 0;
			setStream("");
			const step = () => {
				i += 2;
				setStream(answer.slice(0, i));
				if (i < answer.length) {
					later(step, TYPE_MS);
				} else {
					setStream(null);
					setMessages((m) => [
						...m,
						{ id: nextId.current++, role: "assistant", text: answer },
					]);
				}
			};
			step();
		}, 900);
	}

	function resetConversation() {
		touch("reset");
		timers.current.forEach(clearTimeout);
		timers.current = [];
		setTyping(false);
		setStream(null);
		setMessages([]);
		setRated({});
	}

	function startCall() {
		if (busy) return;
		touch("voice");
		setCallStatus("connecting");
		setCallSec(0);
		setMuted(false);
		setInCall(true);
	}

	function endCall() {
		setInCall(false);
		// The real widget persists the transcript as a system row on the
		// conversation at call end — the note mirrors that.
		setMessages((m) => [
			...m,
			{
				id: nextId.current++,
				role: "note",
				text: "Voice call ended — the transcript was saved to this conversation.",
			},
		]);
	}

	const toggleChip = (q: string) => {
		touch("questions");
		setChips((prev) =>
			prev.includes(q) ? prev.filter((c) => c !== q) : [...prev, q],
		);
	};

	const faceChip = (size: string) =>
		face ? (
			// eslint-disable-next-line @next/next/no-img-element
			<img src={face} alt="" className={`${size} rounded-full object-cover`} />
		) : (
			<Sparkle className={`${size} p-1`} />
		);

	const callTime = `${Math.floor(callSec / 60)}:${String(callSec % 60).padStart(2, "0")}`;

	const assistantBubble = (text: string, key: React.Key, id?: number) => (
		<div key={key} className="max-w-[85%] self-start">
			<div
				className="rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[0.82rem] leading-snug"
				style={{ backgroundColor: t.sf2, color: t.tx2 }}
			>
				{text}
			</div>
			{id !== undefined && (
				<div className="mt-1 flex gap-1 pl-1">
					{(["up", "down"] as const).map((dir) => (
						<button
							key={dir}
							type="button"
							aria-label={dir === "up" ? "Good answer" : "Bad answer"}
							aria-pressed={rated[id] === dir}
							onClick={() => {
								touch("rating");
								setRated((r) => ({ ...r, [id]: dir }));
							}}
							className="rounded p-0.5 text-xs transition-transform hover:scale-110"
							style={{
								color: rated[id] === dir ? color : t.tx5,
								opacity: rated[id] && rated[id] !== dir ? 0.4 : 1,
							}}
						>
							{dir === "up" ? "👍" : "👎"}
						</button>
					))}
				</div>
			)}
		</div>
	);

	return (
		<div className="grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr]">
			{/* ── Control rail — the dashboard's Widget tab, rehearsed ── */}
			<div className="order-2 lg:order-1">
				<div className="rounded-3xl border border-rule bg-paper-card p-6 shadow-lift sm:p-7">
					<p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">
						Settings → Widget
					</p>

					{/* Brand color */}
					<fieldset className="mt-5">
						<legend className="text-sm font-semibold text-ink">
							Brand color
						</legend>
						<div className="mt-2.5 flex flex-wrap items-center gap-2">
							{SWATCHES.map((s) => (
								<button
									key={s.value}
									type="button"
									aria-label={`Brand color ${s.name}`}
									aria-pressed={color === s.value}
									onClick={() => {
										touch("color");
										setColor(s.value);
									}}
									className={`size-9 rounded-xl border transition-transform hover:scale-105 ${
										color === s.value
											? "border-ink/60 ring-2 ring-accent/50 ring-offset-2 ring-offset-paper-card"
											: "border-rule"
									}`}
									style={{ backgroundColor: s.value }}
								/>
							))}
							<label className="relative ml-1 inline-flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-rule text-faint transition-colors hover:border-accent/50 hover:text-accent">
								<input
									type="color"
									value={color}
									aria-label="Custom brand color"
									onChange={(e) => setColor(e.target.value)}
									className="absolute inset-0 size-full cursor-pointer opacity-0"
								/>
								<span aria-hidden className="text-base leading-none">
									+
								</span>
							</label>
							<code className="ml-1 font-mono text-xs text-muted">{color}</code>
						</div>
					</fieldset>

					{/* Agent photo */}
					<fieldset className="mt-6">
						<legend className="text-sm font-semibold text-ink">
							Agent photo
						</legend>
						<p className="mt-0.5 text-xs leading-relaxed text-muted">
							Give the widget a face — shown on the launcher and the header.
						</p>
						<div className="mt-2.5 flex items-center gap-2">
							<button
								type="button"
								aria-label="No photo — default mark"
								aria-pressed={face === null}
								onClick={() => {
									touch("photo");
									setFace(null);
								}}
								className={`flex size-11 items-center justify-center rounded-full border text-white transition-transform hover:scale-105 ${
									face === null
										? "ring-2 ring-accent/50 ring-offset-2 ring-offset-paper-card"
										: ""
								}`}
								style={{ backgroundColor: color, borderColor: "transparent" }}
							>
								<Sparkle className="size-5" />
							</button>
							{FACES.map((f) => (
								<button
									key={f.id}
									type="button"
									aria-label={`Agent photo ${f.label}`}
									aria-pressed={face === f.src}
									onClick={() => {
										touch("photo");
										setFace(f.src);
									}}
									className={`size-11 overflow-hidden rounded-full border border-rule transition-transform hover:scale-105 ${
										face === f.src
											? "ring-2 ring-accent/50 ring-offset-2 ring-offset-paper-card"
											: ""
									}`}
								>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img src={f.src} alt="" className="size-full object-cover" />
								</button>
							))}
							<span className="ml-1 text-xs text-faint">
								or upload your own
							</span>
						</div>
					</fieldset>

					{/* Welcome message */}
					<div className="mt-6">
						<label
							htmlFor="studio-welcome"
							className="text-sm font-semibold text-ink"
						>
							Welcome message
						</label>
						<input
							id="studio-welcome"
							value={welcome}
							maxLength={120}
							onChange={(e) => {
								setWelcome(e.target.value);
							}}
							onFocus={() => touch("welcome")}
							className="mt-2 w-full rounded-xl border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
							placeholder="Hi! How can I help you today?"
						/>
					</div>

					{/* Suggested questions */}
					<fieldset className="mt-6">
						<legend className="text-sm font-semibold text-ink">
							Suggested questions
						</legend>
						<p className="mt-0.5 text-xs leading-relaxed text-muted">
							Tappable chips before the first message — toggle them, then tap
							one in the widget.
						</p>
						<div className="mt-2.5 flex flex-wrap gap-2">
							{CHIP_PRESETS.map((q) => {
								const on = chips.includes(q);
								return (
									<button
										key={q}
										type="button"
										aria-pressed={on}
										onClick={() => toggleChip(q)}
										className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
											on
												? "border-accent/50 bg-accent/10 text-ink"
												: "border-rule text-muted hover:border-accent/40 hover:text-ink"
										}`}
									>
										{on ? "✓ " : "+ "}
										{q}
									</button>
								);
							})}
						</div>
					</fieldset>

					{/* Voice calls — the Scale entitlement */}
					<fieldset className="mt-6">
						<legend className="text-sm font-semibold text-ink">
							Live voice calls
							<span className="ml-2 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 align-middle font-mono text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-accent-soft">
								Scale
							</span>
						</legend>
						<p className="mt-0.5 text-xs leading-relaxed text-muted">
							Visitors talk to the agent instead of typing — the transcript
							lands in the conversation. Try the{" "}
							<Stroke
								d={PHONE_D}
								className="inline size-3 align-[-0.1em] text-accent"
							/>{" "}
							button in the widget header.
						</p>
						<button
							type="button"
							role="switch"
							aria-checked={voiceOn}
							aria-label="Live voice calls"
							onClick={() => {
								touch("voice-toggle");
								if (voiceOn && inCall) endCall();
								setVoiceOn(!voiceOn);
							}}
							className={`mt-2.5 inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
								voiceOn
									? "justify-end border-accent/50 bg-accent"
									: "justify-start border-rule bg-paper-raise"
							}`}
						>
							<span className="mx-0.5 size-4 rounded-full bg-white shadow" />
						</button>
					</fieldset>

					{/* Theme */}
					<fieldset className="mt-6">
						<legend className="text-sm font-semibold text-ink">Theme</legend>
						<div className="mt-2.5 inline-flex rounded-xl border border-rule bg-paper p-1">
							{(["light", "dark"] as const).map((mode) => (
								<button
									key={mode}
									type="button"
									aria-pressed={theme === mode}
									onClick={() => {
										touch("theme");
										setTheme(mode);
									}}
									className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
										theme === mode
											? "bg-paper-card text-ink shadow-sm"
											: "text-muted hover:text-ink"
									}`}
								>
									{mode}
								</button>
							))}
						</div>
						<p className="mt-2 text-xs text-faint">
							“Auto” follows the visitor&apos;s OS — set it per site with{" "}
							<code className="font-mono">data-theme</code>
						</p>
					</fieldset>
				</div>

				<p className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-faint">
					A rehearsal of the real controls — scripted replies, no backend. The
					real widget is bottom-right.
				</p>
			</div>

			{/* ── Stage — the widget on "your site" ── */}
			<div className="order-1 lg:order-2">
				<div className="overflow-hidden rounded-3xl border border-rule bg-paper-card shadow-lift">
					{/* Browser chrome */}
					<div className="flex items-center gap-3 border-b border-rule-soft px-5 py-3">
						<span className="flex gap-1.5" aria-hidden>
							<i className="size-2.5 rounded-full bg-rule" />
							<i className="size-2.5 rounded-full bg-rule" />
							<i className="size-2.5 rounded-full bg-rule" />
						</span>
						<span className="rounded-md bg-paper-deep px-3 py-1 font-mono text-[0.65rem] text-muted">
							yourstore.com
						</span>
					</div>

					{/* Ghost page + widget */}
					<div className="relative h-[540px] bg-paper-deep/40 sm:h-[560px]">
						{/* Ghost content — "your site", abstracted */}
						<div aria-hidden className="p-6 opacity-70 sm:p-8">
							<div className="h-3 w-24 rounded bg-rule" />
							<div className="mt-5 h-6 w-3/5 rounded bg-rule" />
							<div className="mt-2.5 h-6 w-2/5 rounded bg-rule/70" />
							<div className="mt-5 h-2.5 w-1/2 rounded bg-rule/60" />
							<div className="mt-2 h-2.5 w-2/5 rounded bg-rule/60" />
							<div className="mt-6 flex gap-3">
								<div
									className="h-8 w-28 rounded-full"
									style={{ backgroundColor: color, opacity: 0.85 }}
								/>
								<div className="h-8 w-28 rounded-full border border-rule" />
							</div>
						</div>

						{/* The widget, bottom-right — exactly where it lives */}
						<div className="absolute bottom-4 right-4 flex flex-col items-end gap-3 sm:bottom-5 sm:right-5">
							{open ? (
								<div
									className={`flex flex-col overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10 transition-all ${
										expanded
											? "w-[300px] sm:w-[400px]"
											: "w-[280px] sm:w-[320px]"
									}`}
									style={{ backgroundColor: t.sf }}
								>
									{/* Header */}
									<div
										className="flex items-center gap-2.5 px-4 py-3"
										style={{ backgroundColor: color, color: fg }}
									>
										<span
											className="flex size-7 items-center justify-center overflow-hidden rounded-full"
											style={{ backgroundColor: "rgba(0,0,0,0.22)" }}
										>
											{faceChip("size-7")}
										</span>
										<span className="text-sm font-semibold">Support</span>
										<span className="ml-auto flex items-center gap-1.5">
											{voiceOn && !inCall && (
												<button
													type="button"
													aria-label="Start a voice call"
													title="Start a voice call"
													onClick={startCall}
													className="opacity-80 transition-opacity hover:opacity-100"
												>
													<Stroke d={PHONE_D} className="size-4" />
												</button>
											)}
											{hasUserMessage && !inCall && (
												<button
													type="button"
													aria-label="Start a new conversation"
													title="Start a new conversation"
													onClick={resetConversation}
													className="opacity-80 transition-opacity hover:opacity-100"
												>
													<Stroke d={COMPOSE_D} className="size-4" />
												</button>
											)}
											<button
												type="button"
												aria-label={expanded ? "Collapse chat" : "Expand chat"}
												aria-pressed={expanded}
												onClick={() => setExpanded(!expanded)}
												className="opacity-80 transition-opacity hover:opacity-100"
											>
												<Stroke d={EXPAND_D} className="size-4" />
											</button>
											<button
												type="button"
												aria-label="Close preview chat"
												onClick={() => setOpen(false)}
												className="opacity-80 transition-opacity hover:opacity-100"
											>
												<Stroke d={CLOSE_D} className="size-4" />
											</button>
										</span>
									</div>

									{inCall ? (
										/* Voice call — the widget's call screen, rehearsed */
										<div className="flex flex-col items-center gap-3 px-4 py-8">
											<div className="relative">
												<span
													aria-hidden
													className={`absolute inset-0 rounded-full ${
														callStatus === "connecting" ? "" : "animate-ping"
													}`}
													style={{
														backgroundColor: `${color}40`,
														animationDuration:
															callStatus === "speaking" ? "0.9s" : "2.4s",
													}}
												/>
												<span
													className="relative flex size-[88px] items-center justify-center overflow-hidden rounded-full"
													style={{ backgroundColor: color }}
												>
													{faceChip("size-[88px]")}
												</span>
											</div>
											<p
												role="status"
												className="text-[0.82rem] font-medium"
												style={{ color: t.tx2 }}
											>
												{CALL_LABEL[callStatus]}
											</p>
											<p
												className="font-mono text-[0.7rem] tabular-nums"
												style={{ color: t.tx5 }}
											>
												{callTime}
											</p>
											<div className="mt-1 flex items-center gap-3">
												<button
													type="button"
													aria-label={
														muted ? "Unmute microphone" : "Mute microphone"
													}
													aria-pressed={muted}
													onClick={() => setMuted(!muted)}
													className="flex size-10 items-center justify-center rounded-full border transition-colors"
													style={{
														borderColor: t.ln,
														color: muted ? "#dc2626" : t.tx2,
														backgroundColor: t.sf2,
													}}
												>
													<Stroke
														d={muted ? MIC_OFF_D : MIC_D}
														className="size-4"
													/>
												</button>
												<button
													type="button"
													aria-label="End call"
													onClick={endCall}
													className="flex size-10 items-center justify-center rounded-full bg-red-600 text-white transition-transform hover:scale-105"
												>
													<Stroke
														d={PHONE_D}
														className="size-4 rotate-[135deg]"
													/>
												</button>
											</div>
										</div>
									) : (
										<>
											{/* Conversation */}
											<div
												ref={scrollRef}
												className={`flex flex-col gap-2.5 overflow-y-auto p-4 ${
													expanded
														? "h-[290px] sm:h-[300px]"
														: "h-[220px] sm:h-[230px]"
												}`}
											>
												{assistantBubble(
													welcome.trim() || "Hi! How can I help you today?",
													"welcome",
												)}
												{!hasUserMessage && chips.length > 0 && (
													<div className="flex flex-wrap gap-1.5 pt-0.5">
														{chips.map((q) => (
															<button
																key={q}
																type="button"
																onClick={() => send(q)}
																className="rounded-full border px-2.5 py-1 text-left text-[0.72rem] font-medium transition-transform hover:scale-[1.03]"
																style={{
																	borderColor: `${color}59`,
																	color: theme === "dark" ? t.tx2 : color,
																	backgroundColor: `${color}14`,
																}}
															>
																{q}
															</button>
														))}
													</div>
												)}
												{messages.map((m) =>
													m.role === "user" ? (
														<div
															key={m.id}
															className="max-w-[85%] self-end rounded-2xl rounded-br-md px-3.5 py-2.5 text-[0.82rem] leading-snug"
															style={{ backgroundColor: color, color: fg }}
														>
															{m.text}
														</div>
													) : m.role === "assistant" ? (
														assistantBubble(m.text, m.id, m.id)
													) : (
														<p
															key={m.id}
															className="self-center rounded-full border px-3 py-1 text-center text-[0.66rem]"
															style={{ borderColor: t.ln, color: t.tx5 }}
														>
															{m.text}
														</p>
													),
												)}
												{typing && (
													<div
														className="flex items-center gap-1.5 self-start rounded-2xl rounded-bl-md px-3.5 py-3"
														style={{ backgroundColor: t.sf2 }}
														aria-label="The agent is typing"
													>
														{[0, 1, 2].map((i) => (
															<span
																key={i}
																className="size-1.5 animate-pulse rounded-full"
																style={{
																	backgroundColor: t.tx5,
																	animationDelay: `${i * 160}ms`,
																}}
															/>
														))}
													</div>
												)}
												{stream !== null && assistantBubble(stream, "stream")}
											</div>

											{/* Composer — it types back */}
											<form
												className="flex items-center gap-2 border-t px-4 py-3"
												style={{ borderColor: t.ln }}
												onSubmit={(e) => {
													e.preventDefault();
													send(draft);
												}}
											>
												<input
													value={draft}
													onChange={(e) => setDraft(e.target.value)}
													placeholder="Ask a question…"
													aria-label="Ask the preview widget a question"
													maxLength={200}
													className="flex-1 bg-transparent text-[0.82rem] focus:outline-none"
													style={{ color: t.tx, caretColor: color }}
												/>
												<button
													type="submit"
													aria-label="Send"
													disabled={busy || !draft.trim()}
													className="transition-transform enabled:hover:scale-110 disabled:opacity-40"
													style={{ color }}
												>
													<Stroke d={SEND_D} className="size-4" />
												</button>
											</form>
											<p
												className="pb-2 text-center text-[0.6rem]"
												style={{ color: t.tx5 }}
											>
												Powered by Clanker Support
											</p>
										</>
									)}
								</div>
							) : (
								<button
									type="button"
									onClick={() => setOpen(true)}
									className="max-w-[240px] rounded-2xl rounded-br-md px-4 py-2.5 text-left text-[0.8rem] leading-snug shadow-xl ring-1 ring-black/10 transition-transform hover:scale-[1.02]"
									style={{ backgroundColor: t.sf, color: t.tx2 }}
								>
									{welcome.trim() || "Hi! How can I help you today?"}
								</button>
							)}

							{/* Launcher */}
							<button
								type="button"
								aria-label={
									open ? "Close the preview widget" : "Open the preview widget"
								}
								onClick={() => setOpen(!open)}
								className="flex size-14 items-center justify-center overflow-hidden rounded-full shadow-xl ring-1 ring-black/10 transition-transform hover:scale-105"
								style={{ backgroundColor: color, color: fg }}
							>
								{open ? (
									<Stroke d={CLOSE_D} className="size-6" />
								) : (
									faceChip("size-14")
								)}
							</button>
						</div>
					</div>
				</div>

				{/* Live embed snippet — the config, as the one line you ship */}
				<div className="mt-4 overflow-x-auto rounded-2xl border border-rule bg-paper-deep/60 px-4 py-3">
					<code className="whitespace-nowrap font-mono text-[0.7rem] leading-relaxed text-muted">
						<span className="text-faint">&lt;script</span> async{" "}
						src=&quot;https://api.clankersupport.com/widget.js&quot;{" "}
						data-project=&quot;pk_your_key&quot;{" "}
						<span className="text-accent-soft">
							data-brand=&quot;{color}&quot;
						</span>
						{theme === "dark" && (
							<span className="text-accent-soft">
								{" "}
								data-theme=&quot;dark&quot;
							</span>
						)}
						<span className="text-faint">&gt;</span>
					</code>
				</div>
			</div>
		</div>
	);
}
