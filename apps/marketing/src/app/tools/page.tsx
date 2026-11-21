import Link from "next/link";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { TOOLS } from "@/lib/tools";
import {
	breadcrumbLd,
	faqPageLd,
	itemListLd,
	pageMeta,
	type Faq,
} from "@/lib/seo";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

export const metadata = pageMeta({
	title: "Free Customer Support Tools — Clanker Support",
	description:
		"Free tools for support teams: an AI support savings calculator, CSAT calculator, canned response generator, and llms.txt generator. No sign-up required.",
	path: "/tools",
});

const faqs: Faq[] = [
	{
		question: "Are these customer support tools really free?",
		answer:
			"Yes. Every tool on this page is free to use with no sign-up, no email gate, and no usage limit. Open one, enter your numbers or text, and copy the result.",
	},
	{
		question: "Is the data I enter sent anywhere?",
		answer:
			"No. The calculators and generators run entirely in your browser: the ticket volumes, costs, and reply text you type are computed on the page and never posted to a server.",
	},
	{
		question: "Which tool should a support team start with?",
		answer:
			"Start with the AI support savings calculator to size the opportunity from your ticket volume and handle time, then use the CSAT calculator to set a baseline you can compare against after an AI agent goes live.",
	},
	{
		question: "What is an llms.txt file and do I need one?",
		answer:
			"llms.txt is a plain-text file at your site root that tells AI assistants what your product is and where your key pages live. It helps answer engines such as ChatGPT and Perplexity describe you accurately; the llms.txt generator builds a spec-correct one in a minute.",
	},
];

export default function ToolsPage() {
	return (
		<>
			<JsonLd data={faqPageLd(faqs)} />
			<JsonLd
				data={itemListLd(
					TOOLS.map((t) => ({
						name: t.name,
						url: `${CANONICAL_SITE_URL}/tools/${t.slug}`,
					})),
				)}
			/>
			<JsonLd
				data={breadcrumbLd(CANONICAL_SITE_URL, [
					{ name: "Home", path: "/" },
					{ name: "Free tools", path: "/tools" },
				])}
			/>
			<SiteHeader active="resources" />

			<main className="mx-auto max-w-6xl px-6">
				{/* ── Hero ─────────────────────────────────────────────── */}
				<section className="relative overflow-hidden pt-16 sm:pt-20">
					<span
						aria-hidden
						className="pointer-events-none absolute -right-6 -top-8 select-none font-display text-[9rem] font-bold leading-none text-rule/70 sm:text-[14rem]"
					>
						⌘
					</span>
					<div className="relative">
						<p className="kicker animate-rise-in">
							Free tools · No sign-up, no gate
						</p>
						<h1 className="font-display animate-rise-in mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.04] tracking-tight-display text-ink [animation-delay:80ms] sm:text-6xl">
							Sharp little tools for support teams.
						</h1>
						<p className="animate-rise-in mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted [animation-delay:140ms]">
							Calculators and generators we wished existed, so we built them —
							free, ungated, and open in your browser. Use them daily; no
							account needed.
						</p>
					</div>
				</section>

				{/* ── Tool grid ────────────────────────────────────────── */}
				<section className="animate-rise-in mt-14 [animation-delay:220ms]">
					<div className="grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule sm:grid-cols-2">
						{TOOLS.map((tool) => (
							<Link
								key={tool.slug}
								href={`/tools/${tool.slug}`}
								className="group relative overflow-hidden bg-paper p-8 transition-colors hover:bg-paper-card sm:p-10"
							>
								<span
									aria-hidden
									className="pointer-events-none absolute -right-3 -top-8 select-none font-display text-[7rem] font-bold leading-none text-rule/60 transition-colors group-hover:text-accent/10"
								>
									{tool.num}
								</span>
								<div className="relative">
									<span className="font-mono text-xs font-medium text-faint transition-colors group-hover:text-accent-soft">
										{tool.num}
									</span>
									<h2 className="font-display mt-4 text-2xl font-semibold tracking-tight-display text-ink">
										{tool.name}
									</h2>
									<p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
										{tool.tagline}
									</p>
									<span className="mt-6 inline-flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-accent-soft">
										Open the tool
										<span
											aria-hidden
											className="transition-transform group-hover:translate-x-1"
										>
											→
										</span>
									</span>
								</div>
							</Link>
						))}
					</div>
				</section>

				{/* ── Why free ─────────────────────────────────────────── */}
				<section className="mt-20">
					<div className="flex items-center gap-4">
						<h2 className="kicker">Why these are free</h2>
						<span className="h-px flex-1 bg-rule" />
					</div>
					<p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-soft">
						We build an open-source AI support agent, so tools that make support
						teams faster are the most honest marketing we can do. No email gate,
						no trial wall — if one of them saves you an hour, you know where to
						find the rest of the product.
					</p>
				</section>

				<FaqSection faqs={faqs} />
				<div className="pb-24" />
			</main>

			<SiteFooter />
		</>
	);
}
