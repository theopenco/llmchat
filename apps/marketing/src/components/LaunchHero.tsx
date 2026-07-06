// Launch hero for the Product Hunt announcement. Adapted from the Claude Design
// project "Clanker Support Hero" — variant 1A (dark ink · indigo accent). The
// source was a fixed 1600×900 canvas; this is the responsive translation. The
// dark/indigo palette is self-contained so the launch banner reads as its own
// branded moment; it reuses the site's display + mono fonts for consistency.
//
// `preview` renders a static, non-interactive, fixed-size version (forced
// side-by-side layout, no viewport-dependent sizing, heading as a div, no
// links, aria-hidden) for use as a scaled thumbnail — see HeroThumbnail.

const INK = "#0c0e1a";
const ACCENT = "#7CA2FF";
const PRODUCT_HUNT_URL = "https://www.producthunt.com/products/clanker-support";

const PILLS = ["One script tag", "Any model", "Open & self-hostable"];

export function LaunchHero({ preview = false }: { preview?: boolean }) {
	const HeadingTag = preview ? "div" : "h1";
	return (
		<section
			aria-hidden={preview || undefined}
			aria-labelledby={preview ? undefined : "launch-hero-heading"}
			className={`relative overflow-hidden rounded-[22px] shadow-[0_30px_80px_rgba(0,0,0,0.45)]${
				preview ? "" : " mt-8"
			}`}
			style={{ background: INK }}
		>
			{/* Indigo glow + faint dot grid — atmosphere, not content. */}
			<div
				aria-hidden
				className="pointer-events-none absolute -right-40 -top-52 h-[480px] w-[480px] rounded-full"
				style={{
					background:
						"radial-gradient(circle, rgba(124,162,255,.20), transparent 68%)",
				}}
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					backgroundImage:
						"radial-gradient(rgba(255,255,255,.025) 1px, transparent 1px)",
					backgroundSize: "26px 26px",
				}}
			/>

			<div
				className={
					preview
						? "relative flex flex-row items-stretch gap-16 p-16"
						: "relative flex flex-col gap-12 p-8 sm:p-12 lg:flex-row lg:items-stretch lg:gap-16 lg:p-16"
				}
			>
				{/* LEFT — type */}
				<div className="flex min-w-0 flex-1 flex-col">
					<div
						className="mb-8 flex flex-wrap items-center gap-x-3.5 gap-y-2"
						style={{ fontFamily: "var(--font-mono), monospace" }}
					>
						<span
							className="inline-flex items-center gap-2 text-[13px] font-bold tracking-[0.16em]"
							style={{ color: ACCENT }}
						>
							<span
								className="h-2.5 w-2.5 animate-pulse rounded-full"
								style={{ background: ACCENT }}
							/>
							LIVE TODAY
						</span>
						<span
							className="h-[5px] w-[5px] rounded-full"
							style={{ background: "#2f3350" }}
						/>
						{preview ? (
							<span
								className="text-[13px] font-medium tracking-[0.16em]"
								style={{ color: "#7E90C2" }}
							>
								FEATURED ON PRODUCT HUNT
							</span>
						) : (
							<a
								href={PRODUCT_HUNT_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="text-[13px] font-medium tracking-[0.16em] transition-colors hover:text-[#7CA2FF]"
								style={{ color: "#7E90C2" }}
							>
								FEATURED ON PRODUCT HUNT ↗
							</a>
						)}
					</div>

					<HeadingTag
						id={preview ? undefined : "launch-hero-heading"}
						className="font-bold tracking-[-0.03em]"
						style={{
							fontFamily: "var(--font-display), sans-serif",
							color: "#f3f5ee",
							lineHeight: 0.96,
							fontSize: preview ? "82px" : "clamp(2.5rem, 5.2vw, 5.1rem)",
						}}
					>
						Answers from your docs.{" "}
						<span style={{ color: ACCENT }}>Escalates</span> the moment it
						can&apos;t.
					</HeadingTag>

					<p
						className="mt-8 max-w-xl"
						style={{
							color: "#aeb0c6",
							lineHeight: 1.45,
							fontSize: preview ? "25px" : "clamp(1.05rem, 1.5vw, 1.5rem)",
						}}
					>
						Most AI support tools bluff. Clanker hands the conversation to a
						real human instead — full thread intact, nobody re-explaining a
						thing.
					</p>

					<div
						className={
							preview
								? "mt-auto flex flex-wrap gap-3 pt-12"
								: "mt-10 flex flex-wrap gap-3 lg:mt-auto lg:pt-12"
						}
						style={{ fontFamily: "var(--font-mono), monospace" }}
					>
						{PILLS.map((pill) => (
							<span
								key={pill}
								className="rounded-full px-[18px] py-[11px] text-[15px] font-medium"
								style={{ color: "#e8ebe2", border: "1.5px solid #262a40" }}
							>
								{pill}
							</span>
						))}
						<span
							className="rounded-full px-[18px] py-[11px] text-[15px] font-bold"
							style={{ color: INK, background: ACCENT }}
						>
							$19/mo flat
						</span>
					</div>
				</div>

				{/* RIGHT — widget mock showing the escalation-to-human moment */}
				<div
					className={
						preview
							? "flex w-[452px] flex-shrink-0 items-center"
							: "flex w-full flex-shrink-0 items-center lg:w-[420px]"
					}
				>
					<div
						className="w-full overflow-hidden rounded-[22px] shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
						style={{ background: "#f5f3ec" }}
					>
						<div
							className="flex items-center gap-3 border-b px-5 py-[18px]"
							style={{ borderColor: "#e3e0d6" }}
						>
							<div
								className="flex h-[38px] w-[38px] items-center justify-center gap-[5px] rounded-[10px]"
								style={{ background: INK }}
							>
								<span
									className="h-1.5 w-1.5 rounded-full"
									style={{ background: ACCENT }}
								/>
								<span
									className="h-1.5 w-1.5 rounded-full"
									style={{ background: ACCENT }}
								/>
							</div>
							<div className="flex-1">
								<div
									className="text-base font-semibold"
									style={{ color: "#171a14" }}
								>
									Support
								</div>
								<div
									className="text-[11px] font-medium"
									style={{
										fontFamily: "var(--font-mono), monospace",
										color: "#5B7FD4",
									}}
								>
									● powered by Clanker
								</div>
							</div>
						</div>

						<div
							className="flex flex-col gap-[13px] p-5"
							style={{ background: "#faf9f4" }}
						>
							<div
								className="max-w-[78%] self-end rounded-[16px_16px_4px_16px] px-[15px] py-[11px] text-[15.5px] leading-[1.4]"
								style={{ background: INK, color: "#f3f5ee" }}
							>
								Can I get a refund 45 days after purchase?
							</div>
							<div
								className="max-w-[82%] self-start rounded-[16px_16px_16px_4px] px-[15px] py-[11px] text-[15.5px] leading-[1.4]"
								style={{ background: "#ecebe2", color: "#262a22" }}
							>
								Our docs only cover the 30-day window — I won&apos;t guess on
								this one.
							</div>
							<div
								className="my-1 inline-flex items-center gap-2 self-center rounded-full px-[13px] py-[7px] text-[12px] font-bold tracking-[0.06em]"
								style={{
									fontFamily: "var(--font-mono), monospace",
									color: "#3b3a96",
									background: "#e5e4fb",
								}}
							>
								↗ ESCALATED TO YOUR TEAM
							</div>
							<div className="flex max-w-[88%] gap-[9px] self-start">
								<div
									className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
									style={{ background: "#e07a5f" }}
								>
									P
								</div>
								<div
									className="rounded-[16px_16px_16px_4px] px-[15px] py-[11px] text-[15.5px] leading-[1.4]"
									style={{ background: "#ecebe2", color: "#262a22" }}
								>
									Hi, I&apos;m Priya from support — I&apos;ll sort this refund
									out for you right now. 👋
								</div>
							</div>
						</div>

						<div
							className="flex items-center gap-2.5 border-t px-[18px] py-[14px]"
							style={{ borderColor: "#e3e0d6", background: "#f5f3ec" }}
						>
							<span className="flex-1 text-[15px]" style={{ color: "#9a978c" }}>
								Reply to Priya…
							</span>
							<span
								className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-base"
								style={{ background: ACCENT, color: INK }}
							>
								➤
							</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
