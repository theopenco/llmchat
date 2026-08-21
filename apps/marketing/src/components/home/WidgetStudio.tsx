"use client";

import { useState } from "react";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";

/**
 * An interactive rehearsal of the dashboard's Widget studio: every control
 * here exists for real in Settings → Widget (brand color, agent photo,
 * welcome message, suggested questions, light/dark theme), and the preview
 * mirrors the shipped widget's anatomy — same surface palette as
 * packages/widget/src/styles.ts, same contrast-derived on-brand foreground
 * as packages/widget/src/contrast.ts. Nothing here is invented UI.
 *
 * Purely client-side: no backend, nothing leaves the page. The real widget
 * (bottom-right of this page) is the proof.
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

function Sparkle({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" className={className}>
			<path d="M12 2.5c.4 3.9 1.7 6.6 3.4 8.1 1.6 1.4 3.7 2 6.1 2.4-2.4.4-4.5 1-6.1 2.4-1.7 1.5-3 4.2-3.4 8.1-.4-3.9-1.7-6.6-3.4-8.1-1.6-1.4-3.7-2-6.1-2.4 2.4-.4 4.5-1 6.1-2.4 1.7-1.5 3-4.2 3.4-8.1Z" />
		</svg>
	);
}

export function WidgetStudio() {
	const [color, setColor] = useState("#ea580c");
	const [face, setFace] = useState<string | null>(FACES[0].src);
	const [welcome, setWelcome] = useState("Hi! How can I help you today?");
	const [chips, setChips] = useState<string[]>(CHIP_PRESETS.slice(0, 2));
	const [theme, setTheme] = useState<"light" | "dark">("light");
	const [open, setOpen] = useState(true);

	const t = WIDGET_THEME[theme];
	const fg = onBrandForeground(color);

	const touch = (control: string) =>
		track(ANALYTICS_EVENTS.ctaClicked, {
			label: "widget_studio",
			location: "home_studio",
			control,
		});

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
							Tappable chips before the first message — toggle to try.
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
					A rehearsal of the real controls — same fields, live preview, no
					deploy
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
					<div className="relative h-[500px] bg-paper-deep/40 sm:h-[540px]">
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
									className="flex w-[280px] flex-col overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10 sm:w-[320px]"
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
										<span className="ml-auto flex items-center gap-1 opacity-80">
											<svg
												viewBox="0 0 24 24"
												className="size-4"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												aria-hidden
											>
												<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
											</svg>
											<button
												type="button"
												aria-label="Close preview chat"
												onClick={() => setOpen(false)}
												className="transition-opacity hover:opacity-100"
											>
												<svg
													viewBox="0 0 24 24"
													className="size-4"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
													aria-hidden
												>
													<path d="M6 6l12 12M18 6L6 18" />
												</svg>
											</button>
										</span>
									</div>

									{/* Conversation */}
									<div className="flex min-h-[190px] flex-col gap-2.5 p-4">
										<div
											className="max-w-[85%] self-start rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[0.82rem] leading-snug"
											style={{ backgroundColor: t.sf2, color: t.tx2 }}
										>
											{welcome.trim() || "Hi! How can I help you today?"}
										</div>
										{chips.length > 0 && (
											<div className="flex flex-wrap gap-1.5 pt-0.5">
												{chips.map((q) => (
													<span
														key={q}
														className="rounded-full border px-2.5 py-1 text-[0.72rem] font-medium"
														style={{
															borderColor: `${color}59`,
															color: theme === "dark" ? t.tx2 : color,
															backgroundColor: `${color}14`,
														}}
													>
														{q}
													</span>
												))}
											</div>
										)}
									</div>

									{/* Composer */}
									<div
										className="flex items-center gap-2 border-t px-4 py-3"
										style={{ borderColor: t.ln }}
									>
										<span
											className="flex-1 text-[0.82rem]"
											style={{ color: t.tx5 }}
										>
											Ask a question…
										</span>
										<svg
											viewBox="0 0 24 24"
											className="size-4"
											fill="none"
											stroke={color}
											strokeWidth="2.2"
											aria-hidden
										>
											<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
										</svg>
									</div>
									<p
										className="pb-2 text-center text-[0.6rem]"
										style={{ color: t.tx5 }}
									>
										Powered by Clanker Support
									</p>
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
									<svg
										viewBox="0 0 24 24"
										className="size-6"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.2"
										aria-hidden
									>
										<path d="M6 6l12 12M18 6L6 18" />
									</svg>
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
