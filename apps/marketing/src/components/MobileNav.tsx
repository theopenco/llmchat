"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

import { ThemeToggle } from "@/components/ThemeToggle";

type NavKey = "features" | "resources" | "compare";

const links: { label: string; href: string; active?: NavKey }[] = [
	{ label: "Features", href: "/#features", active: "features" },
	{ label: "Docs", href: "/docs", active: "resources" },
	{ label: "Blog", href: "/blog", active: "resources" },
	{ label: "Compare", href: "/compare", active: "compare" },
];

/**
 * Mobile-only navigation. The desktop nav is hidden below `sm`, so without this
 * a phone visitor only sees the logo + auth button. Hamburger toggles a
 * slide-down panel; matches the dark indigo aesthetic with mono index numbers
 * and a staggered reveal. CSS-hover dropdowns don't work on touch, hence JS.
 *
 * The overlay + panel render through a portal to `document.body`: the sticky
 * header uses `backdrop-blur`, which establishes a containing block for fixed
 * descendants and would otherwise trap the full-screen overlay inside the
 * 64px-tall header.
 */
export function MobileNav({
	active,
	showcaseUrl,
}: {
	active?: NavKey;
	showcaseUrl: string;
}) {
	const [open, setOpen] = useState(false);
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	// Lock body scroll and close on Escape while the menu is open.
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prevOverflow;
		};
	}, [open]);

	return (
		<div className="sm:hidden">
			<button
				type="button"
				aria-label={open ? "Close menu" : "Open menu"}
				aria-expanded={open}
				aria-controls="mobile-nav-panel"
				onClick={() => setOpen((v) => !v)}
				className="relative z-50 inline-flex size-10 items-center justify-center rounded-full border border-rule text-ink transition-colors hover:border-accent/40"
			>
				<span className="relative block h-3 w-[18px]" aria-hidden>
					<span
						className={`absolute left-0 block h-[1.5px] w-full rounded-full bg-current transition-all duration-300 ${
							open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
						}`}
					/>
					<span
						className={`absolute left-0 top-1/2 block h-[1.5px] w-full -translate-y-1/2 rounded-full bg-current transition-opacity duration-200 ${
							open ? "opacity-0" : "opacity-100"
						}`}
					/>
					<span
						className={`absolute left-0 block h-[1.5px] w-full rounded-full bg-current transition-all duration-300 ${
							open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"
						}`}
					/>
				</span>
			</button>

			{mounted &&
				createPortal(
					<div className="sm:hidden">
						{/* Backdrop */}
						<button
							aria-hidden
							tabIndex={-1}
							onClick={() => setOpen(false)}
							className={`fixed inset-x-0 bottom-0 top-16 z-30 bg-paper/80 backdrop-blur-sm transition-opacity duration-300 ${
								open ? "opacity-100" : "pointer-events-none opacity-0"
							}`}
						/>

						{/* Slide-down panel */}
						<nav
							id="mobile-nav-panel"
							className={`fixed inset-x-0 top-16 z-40 origin-top border-b border-rule bg-paper-card/95 shadow-lift backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
								open
									? "translate-y-0 opacity-100"
									: "pointer-events-none -translate-y-4 opacity-0"
							}`}
						>
							<ul className="mx-auto max-w-6xl px-6 py-2">
								{links.map((link, i) => {
									const isActive = link.active && active === link.active;
									return (
										<li
											key={link.label}
											className="border-b border-rule-soft transition-all duration-300"
											style={{
												transitionDelay: open ? `${80 + i * 45}ms` : "0ms",
												opacity: open ? 1 : 0,
												transform: open ? "translateY(0)" : "translateY(6px)",
											}}
										>
											<Link
												href={link.href}
												onClick={() => setOpen(false)}
												className="flex items-center justify-between py-4"
											>
												<span
													className={`text-base font-medium transition-colors ${
														isActive
															? "text-ink"
															: "text-ink-soft hover:text-ink"
													}`}
												>
													{link.label}
												</span>
												<span className="font-mono text-[0.66rem] tracking-[0.14em] text-faint">
													{String(i + 1).padStart(2, "0")}
												</span>
											</Link>
										</li>
									);
								})}
								<li
									className="py-4 transition-all duration-300"
									style={{
										transitionDelay: open
											? `${80 + links.length * 45}ms`
											: "0ms",
										opacity: open ? 1 : 0,
										transform: open ? "translateY(0)" : "translateY(6px)",
									}}
								>
									<a
										href={showcaseUrl}
										onClick={() => setOpen(false)}
										className="inline-flex items-center gap-2 rounded-full border border-rule px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
									>
										<span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_2px_rgba(99,102,241,0.6)]" />
										Live demo
									</a>
								</li>
								<li
									className="flex items-center justify-between border-t border-rule-soft py-4 transition-all duration-300"
									style={{
										transitionDelay: open
											? `${80 + (links.length + 1) * 45}ms`
											: "0ms",
										opacity: open ? 1 : 0,
										transform: open ? "translateY(0)" : "translateY(6px)",
									}}
								>
									<span className="text-base font-medium text-ink-soft">
										Theme
									</span>
									<ThemeToggle />
								</li>
							</ul>
						</nav>
					</div>,
					document.body,
				)}
		</div>
	);
}
