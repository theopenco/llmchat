import Link from "next/link";
import type { ReactNode } from "react";
import { ANALYTICS_EVENTS } from "@llmchat/shared";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { TrackView } from "@/components/TrackView";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { TOOLS, type Tool } from "@/lib/tools";
import { breadcrumbLd, faqPageLd, webApplicationLd } from "@/lib/seo";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

/**
 * Shared shell for every /tools page: JSON-LD (WebApplication + FAQPage +
 * BreadcrumbList), hero, the interactive tool (children), editorial sections,
 * cross-links to the other tools, FAQ, and the product CTA. The tools are
 * ungated on purpose — the page converts through usefulness, not a gate.
 */
export function ToolPage({
	tool,
	children,
}: {
	tool: Tool;
	children: ReactNode;
}) {
	const others = TOOLS.filter((t) => t.slug !== tool.slug);
	const url = `${CANONICAL_SITE_URL}/tools/${tool.slug}`;

	return (
		<>
			<JsonLd
				data={webApplicationLd({
					name: tool.name,
					description: tool.seoDescription,
					url,
				})}
			/>
			<JsonLd data={faqPageLd(tool.faqs)} />
			<JsonLd
				data={breadcrumbLd(CANONICAL_SITE_URL, [
					{ name: "Home", path: "/" },
					{ name: "Free tools", path: "/tools" },
					{ name: tool.name, path: `/tools/${tool.slug}` },
				])}
			/>
			<TrackView
				event={ANALYTICS_EVENTS.toolViewed}
				props={{ tool: tool.slug }}
			/>
			<SiteHeader active="resources" />

			<main className="mx-auto max-w-6xl px-6">
				{/* Breadcrumb */}
				<div className="pt-10">
					<Link
						href="/tools"
						className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-faint transition-colors hover:text-accent"
					>
						← All free tools
					</Link>
				</div>

				{/* ── Hero ─────────────────────────────────────────────── */}
				<section className="relative overflow-hidden pt-8">
					<span
						aria-hidden
						className="pointer-events-none absolute -right-2 -top-6 select-none font-display text-[8rem] font-bold leading-none text-rule/70 sm:text-[13rem]"
					>
						{tool.num}
					</span>

					<div className="relative">
						<p className="kicker animate-rise-in">
							Free tool {tool.num} · No sign-up
						</p>
						<h1 className="font-display animate-rise-in mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.04] tracking-tight-display text-ink [animation-delay:80ms] sm:text-6xl">
							{tool.headline}
						</h1>
						<p className="animate-rise-in mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted [animation-delay:140ms]">
							{tool.lead}
						</p>
					</div>
				</section>

				{/* ── The tool itself ──────────────────────────────────── */}
				<section className="animate-rise-in mt-12 [animation-delay:220ms]">
					{children}
				</section>

				{/* ── Editorial sections ───────────────────────────────── */}
				{tool.body.map((section) => (
					<section key={section.heading} className="mt-20">
						<div className="flex items-center gap-4">
							<h2 className="kicker">{section.heading}</h2>
							<span className="h-px flex-1 bg-rule" />
						</div>
						<div className="mt-6 max-w-2xl space-y-5">
							{section.paragraphs.map((para) => (
								<p
									key={para}
									className="text-base leading-relaxed text-ink-soft"
								>
									{para}
								</p>
							))}
						</div>
					</section>
				))}

				{/* ── Other tools ──────────────────────────────────────── */}
				<section className="mt-20">
					<h2 className="kicker">More free tools</h2>
					<div className="mt-6 grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule sm:grid-cols-3">
						{others.map((t) => (
							<Link
								key={t.slug}
								href={`/tools/${t.slug}`}
								className="group bg-paper p-6 transition-colors hover:bg-paper-card"
							>
								<span className="font-mono text-xs font-medium text-faint transition-colors group-hover:text-accent-soft">
									{t.num}
								</span>
								<h3 className="font-display mt-3 text-base font-semibold tracking-tight-display text-ink">
									{t.name}
								</h3>
								<p className="mt-1.5 text-sm leading-relaxed text-muted">
									{t.tagline}
								</p>
							</Link>
						))}
					</div>
				</section>

				{/* ── FAQ ──────────────────────────────────────────────── */}
				<FaqSection faqs={tool.faqs} />

				{/* ── Closing CTA ──────────────────────────────────────── */}
				<section className="my-24">
					<div className="relative overflow-hidden rounded-[2rem] border border-accent/30 bg-gradient-to-b from-paper-card to-paper px-8 py-16 text-center shadow-glow">
						<div className="grid-backdrop pointer-events-none absolute inset-0" />
						<div className="relative">
							<p className="kicker">Now automate the answers</p>
							<h2 className="font-display mx-auto mt-4 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-tight-display text-ink sm:text-5xl">
								The repetitive half of support can answer itself.
							</h2>
							<p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted">
								Clanker Support answers from your docs, escalates to your team
								when it should, and installs with one script tag.
							</p>
							<div className="mt-9 flex flex-wrap justify-center gap-3">
								<TrackedLink
									href={dashboardUrl}
									event={ANALYTICS_EVENTS.signupStarted}
									eventProps={{ source: "tool_page", tool: tool.slug }}
									className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(99,102,241,0.7)] transition-colors hover:bg-accent-deep"
								>
									Get your support agent now
									<span aria-hidden>→</span>
								</TrackedLink>
								<Link
									href="/pricing"
									className="rounded-full border border-rule px-7 py-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
								>
									See pricing
								</Link>
							</div>
						</div>
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
