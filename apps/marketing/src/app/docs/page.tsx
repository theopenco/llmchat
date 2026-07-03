import type { ReactNode } from "react";
import Link from "next/link";
import { allMigrations, matrix } from "content-collections";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CodeBlock } from "@/components/CodeBlock";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import {
	breadcrumbLd,
	faqPageLd,
	howToLd,
	pageMeta,
	type Faq,
} from "@/lib/seo";
import { CANONICAL_SITE_URL, RSC_PACKAGE } from "@/lib/site-urls";

function InlineCode({ children }: { children: ReactNode }) {
	return (
		<code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[0.8em]">
			{children}
		</code>
	);
}

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export const metadata = pageMeta({
	title: "Docs: Setup, Widget & Migration — Clanker Support",
	description:
		"Get started with Clanker Support: drop in the widget, train it on your docs, configure escalation, and migrate from your current support tool.",
	path: "/docs",
});

const faqs: Faq[] = [
	{
		question: "How do I install Clanker Support?",
		answer: `Create a project in the dashboard to get your public key, then add a single script tag to your site anywhere before the closing </body> tag — no build step required. On Next.js or any React 19 app, install the official ${RSC_PACKAGE} npm package instead — one component in your layout. Most teams are live in under five minutes.`,
	},
	{
		question: "How do I train the bot on my own docs?",
		answer:
			"In project settings, paste your docs and FAQ answers and write a system prompt that sets the bot's tone and boundaries. A tight, current knowledge base produces better answers than a sprawling one, and updates take effect immediately — no retraining.",
	},
	{
		question: "How do I set up escalation to my team?",
		answer:
			"Set an escalation threshold — how many exchanges before the bot hands off — and a notify email. When the bot can't resolve something, the full conversation lands in your inbox with context intact and an alert goes to your notify address.",
	},
	{
		question: "Can I migrate from my current support tool?",
		answer:
			"Yes. There are step-by-step guides for Chatbase, Chatwoot, Crisp, Fin, and Intercom that walk through the embed swap, knowledge-base re-import, and exactly what does and doesn't carry over.",
	},
];

// HowTo for the quickstart — lets answer engines extract the install procedure
// for "how to add Clanker Support" queries.
const quickstartLd = howToLd({
	name: "Add Clanker Support to your site",
	description:
		"Embed the AI support widget on any site with a single script tag.",
	steps: [
		{
			name: "Create a project",
			text: "Sign up and create a project in the dashboard to get your public key.",
		},
		{
			name: "Paste the script tag",
			text: "Add the Clanker Support script tag to your site anywhere before the closing </body> tag.",
		},
		{
			name: "Train and configure",
			text: "Paste your knowledge base, set a system prompt, and choose an escalation threshold and notify email.",
		},
	],
});

const startCards = [
	{
		title: "Quickstart",
		body: "Drop one script tag and go live in under five minutes.",
		href: "#quickstart",
		tag: "5 min",
	},
	{
		title: "Train your bot",
		body: "Paste your knowledge base and system prompt to keep answers on-topic.",
		href: "#knowledge-base",
		tag: "Config",
	},
	{
		title: "Escalation",
		body: "Hand off to your team with full context when the bot can't help.",
		href: "#escalation",
		tag: "Config",
	},
];

const sections = [
	{
		id: "knowledge-base",
		title: "Train your bot",
		paragraphs: [
			"Your bot answers from a knowledge base you control. In project settings, paste your docs, FAQ answers, and a system prompt that sets the bot's tone and boundaries. Keep it focused — a tight, current knowledge base produces better answers than a sprawling one.",
			"Because Clanker Support is built on LLM Gateway, you choose which model runs per project and can swap it with a config change — no code edits. Run a cost-efficient model for routine questions and a more capable one where it matters.",
		],
	},
	{
		id: "escalation",
		title: "Escalation & inbox",
		paragraphs: [
			"Set an escalation threshold — how many exchanges before the bot hands off — and a notify email. When the bot can't resolve something, the full conversation lands in your inbox with context intact, and an alert goes to your notify address.",
			"Your team picks it up from the unified inbox, replies, and the customer sees the response in the same widget conversation.",
		],
	},
	{
		id: "email-threading",
		title: "Email threading",
		paragraphs: [
			"Point an inbound domain at Clanker Support and set your inbound email local in project settings. Customer replies to escalation emails thread back into the widget conversation automatically, and replies you send from the inbox reach the customer by email — no separate helpdesk required.",
		],
	},
];

export default function DocsPage() {
	const migrations = allMigrations.toSorted((a, b) => a.rank - b.rank);

	return (
		<>
			<JsonLd data={quickstartLd} />
			<JsonLd data={faqPageLd(faqs)} />
			<JsonLd
				data={breadcrumbLd(CANONICAL_SITE_URL, [
					{ name: "Home", path: "/" },
					{ name: "Docs", path: "/docs" },
				])}
			/>
			<SiteHeader active="resources" />

			<main className="mx-auto max-w-5xl px-6">
				{/* Hero */}
				<section className="animate-rise-in pt-16 sm:pt-20">
					<p className="kicker">Documentation</p>
					<h1 className="font-display mt-4 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-tight-display text-ink sm:text-6xl">
						Build with{" "}
						<em className="font-normal italic text-accent">Clanker Support</em>
					</h1>
					<p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
						Everything you need to drop in the widget, train it on your content,
						route escalations to your team, and migrate cleanly from your
						current support tool.
					</p>
				</section>

				{/* Get started cards */}
				<section className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-3">
					{startCards.map((card) => (
						<a
							key={card.title}
							href={card.href}
							className="group bg-paper-card p-6 transition-colors hover:bg-paper-deep"
						>
							<div className="flex items-center justify-between">
								<h2 className="font-display text-xl font-semibold text-ink">
									{card.title}
								</h2>
								<span className="font-mono text-[0.62rem] uppercase tracking-wider text-faint">
									{card.tag}
								</span>
							</div>
							<p className="mt-2 text-sm leading-relaxed text-muted">
								{card.body}
							</p>
							<span className="mt-4 inline-block font-mono text-[0.68rem] uppercase tracking-[0.12em] text-accent opacity-0 transition-opacity group-hover:opacity-100">
								Jump ↓
							</span>
						</a>
					))}
				</section>

				{/* Quickstart */}
				<section id="quickstart" className="mt-20 scroll-mt-24">
					<h2 className="font-display border-b-2 border-ink pb-3 text-3xl font-semibold tracking-tight-display text-ink">
						Quickstart
					</h2>
					<p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft">
						Create a project in the dashboard to get your public key, then add a
						single script tag to your site — anywhere before the closing{" "}
						<InlineCode>&lt;/body&gt;</InlineCode> tag. That&apos;s the whole
						integration. Building with Next.js or another React Server
						Components setup? Install the official{" "}
						<InlineCode>{RSC_PACKAGE}</InlineCode> package instead — one Server
						Component in your root layout, no script tag. See the{" "}
						<Link
							href="/blog/nextjs-ai-support-widget-server-component"
							className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
						>
							Next.js tutorial
						</Link>
						.
					</p>
					<div className="mt-6">
						<CodeBlock code={matrix.llmchatEmbed} label="index.html" />
					</div>
					<ul className="mt-6 space-y-3 text-sm text-muted">
						{[
							[
								"data-project",
								"your project's public key (starts with pk_live_).",
							],
							[
								"data-brand",
								"a hex color for the widget header and primary button.",
							],
							[
								"shadow DOM",
								"the widget mounts in isolation, so styles never bleed either way.",
							],
						].map(([k, v]) => (
							<li key={k} className="flex gap-3">
								<span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
								<span>
									<code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[0.8em] text-ink">
										{k}
									</code>{" "}
									— {v}
								</span>
							</li>
						))}
					</ul>
				</section>

				{/* Concept sections */}
				{sections.map((section) => (
					<section
						key={section.id}
						id={section.id}
						className="mt-16 scroll-mt-24"
					>
						<h2 className="font-display text-3xl font-semibold tracking-tight-display text-ink">
							{section.title}
						</h2>
						<div className="mt-4 max-w-2xl space-y-4">
							{section.paragraphs.map((p, i) => (
								<p key={i} className="text-base leading-relaxed text-ink-soft">
									{p}
								</p>
							))}
						</div>
					</section>
				))}

				{/* Migration guides */}
				<section id="migrate" className="mt-20 scroll-mt-24">
					<h2 className="font-display border-b-2 border-ink pb-3 text-3xl font-semibold tracking-tight-display text-ink">
						Migrate to Clanker Support
					</h2>
					<p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
						Already running a support tool? These guides walk through the embed
						swap, knowledge-base re-import, and what does and doesn&apos;t carry
						over — step by step.
					</p>
					<div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-2">
						{migrations.map((m) => (
							<Link
								key={m.slug}
								href={`/docs/migrate/${m.slug}`}
								className="group bg-paper-card p-6 transition-colors hover:bg-paper-deep"
							>
								<div className="flex items-center justify-between">
									<h3 className="font-display text-xl font-semibold text-ink">
										From {m.name}
									</h3>
									<span className="font-mono text-[0.62rem] uppercase tracking-wider text-faint">
										{m.estimatedTime}
									</span>
								</div>
								<p className="mt-2 text-sm leading-relaxed text-muted">
									{m.tagline}
								</p>
								<span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ink transition-colors group-hover:text-accent">
									Read the guide →
								</span>
							</Link>
						))}
					</div>
				</section>

				{/* FAQ */}
				<FaqSection faqs={faqs} />

				{/* CTA */}
				<section className="mt-24 overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center">
					<p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-accent">
						Ready to build?
					</p>
					<h2 className="font-display mx-auto mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight-display text-paper sm:text-5xl">
						Create a project, paste the snippet, ship.
					</h2>
					<div className="mt-8 flex flex-wrap justify-center gap-3">
						<Link
							href={dashboardUrl}
							className="rounded-full bg-paper px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-accent hover:text-paper"
						>
							Get your support agent now
						</Link>
						<Link
							href="/compare"
							className="rounded-full border border-paper/30 px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-paper/10"
						>
							Compare alternatives
						</Link>
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
