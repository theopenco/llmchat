import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { CodeBlock } from "@/components/CodeBlock";
import { llmchatEmbed, migrations } from "@/lib/migrations";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export const metadata = {
	title: "Docs — llmchat",
	description:
		"Get started with llmchat: drop in the widget, train it on your docs, configure escalation, and migrate from your current support tool.",
};

const startCards = [
	{
		title: "Quickstart",
		body: "Drop one script tag on your site and go live in under five minutes.",
		href: "#quickstart",
		tag: "5 min",
	},
	{
		title: "Train your bot",
		body: "Paste your knowledge base and system prompt so answers stay on-topic.",
		href: "#knowledge-base",
		tag: "Config",
	},
	{
		title: "Escalation & inbox",
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
			"Because llmchat is built on LLM Gateway, you choose which model runs per project and can swap it with a config change — no code edits. Run a cost-efficient model for routine questions and a more capable one where it matters.",
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
			"Point an inbound domain at llmchat and set your inbound email local in project settings. Customer replies to escalation emails thread back into the widget conversation automatically, and replies you send from the inbox reach the customer by email — no separate helpdesk required.",
		],
	},
];

export default function DocsPage() {
	return (
		<main className="mx-auto max-w-5xl px-6 py-16">
			<SiteHeader active="resources" />

			{/* Hero */}
			<section className="mt-16 max-w-3xl">
				<p className="text-sm font-medium uppercase tracking-wide text-gray-500">
					Documentation
				</p>
				<h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
					Build with llmchat
				</h1>
				<p className="mt-4 text-lg text-gray-600">
					Everything you need to drop in the widget, train it on your content,
					route escalations to your team, and migrate cleanly from your current
					support tool.
				</p>
			</section>

			{/* Get started cards */}
			<section className="mt-12">
				<h2 className="font-semibold">Get started</h2>
				<div className="mt-4 grid gap-4 sm:grid-cols-3">
					{startCards.map((card) => (
						<a
							key={card.title}
							href={card.href}
							className="rounded-xl border border-gray-200 p-5 transition hover:border-gray-400"
						>
							<div className="flex items-center justify-between">
								<h3 className="font-semibold">{card.title}</h3>
								<span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500">
									{card.tag}
								</span>
							</div>
							<p className="mt-2 text-sm text-gray-600">{card.body}</p>
						</a>
					))}
				</div>
			</section>

			{/* Quickstart */}
			<section id="quickstart" className="mt-16 scroll-mt-8">
				<h2 className="text-xl font-semibold">Quickstart</h2>
				<p className="mt-2 text-sm leading-relaxed text-gray-600">
					Create a project in the dashboard to get your public key, then add a
					single script tag to your site — anywhere before the closing{" "}
					<code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
						&lt;/body&gt;
					</code>{" "}
					tag. That&apos;s the whole integration.
				</p>
				<div className="mt-4">
					<CodeBlock code={llmchatEmbed} label="index.html" />
				</div>
				<ul className="mt-4 space-y-2 text-sm text-gray-600">
					<li className="flex gap-2">
						<span className="mt-0.5 shrink-0 text-gray-400">•</span>
						<span>
							<code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
								data-project
							</code>{" "}
							— your project&apos;s public key (starts with{" "}
							<code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
								pk_live_
							</code>
							).
						</span>
					</li>
					<li className="flex gap-2">
						<span className="mt-0.5 shrink-0 text-gray-400">•</span>
						<span>
							<code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
								data-brand
							</code>{" "}
							— a hex color the widget uses for its header and primary button.
						</span>
					</li>
					<li className="flex gap-2">
						<span className="mt-0.5 shrink-0 text-gray-400">•</span>
						<span>
							The widget mounts inside a shadow DOM, so your page styles and the
							widget never interfere with each other.
						</span>
					</li>
				</ul>
			</section>

			{/* Concept sections */}
			{sections.map((section) => (
				<section key={section.id} id={section.id} className="mt-16 scroll-mt-8">
					<h2 className="text-xl font-semibold">{section.title}</h2>
					<div className="mt-3 space-y-3">
						{section.paragraphs.map((p, i) => (
							<p key={i} className="text-sm leading-relaxed text-gray-600">
								{p}
							</p>
						))}
					</div>
				</section>
			))}

			{/* Migration guides */}
			<section id="migrate" className="mt-16 scroll-mt-8">
				<h2 className="text-xl font-semibold">Migrate to llmchat</h2>
				<p className="mt-2 text-sm leading-relaxed text-gray-600">
					Already running a support tool? These guides walk through the embed
					swap, knowledge-base re-import, and what does and doesn&apos;t carry
					over — step by step.
				</p>
				<div className="mt-6 grid gap-4 sm:grid-cols-2">
					{migrations.map((m) => (
						<Link
							key={m.slug}
							href={`/docs/migrate/${m.slug}`}
							className="rounded-xl border border-gray-200 p-5 transition hover:border-gray-400"
						>
							<div className="flex items-center justify-between">
								<h3 className="font-semibold">Migrate from {m.name}</h3>
								<span className="text-xs text-gray-400">{m.estimatedTime}</span>
							</div>
							<p className="mt-2 text-sm text-gray-600">{m.tagline}</p>
							<span className="mt-3 inline-block text-xs text-gray-500">
								Read the guide →
							</span>
						</Link>
					))}
				</div>
			</section>

			{/* CTA */}
			<section className="mt-16 rounded-xl border border-gray-200 p-8">
				<h2 className="text-xl font-semibold">Ready to build?</h2>
				<p className="mt-2 text-sm text-gray-600">
					Create a project, grab your public key, and paste the snippet. No
					credit card required.
				</p>
				<div className="mt-6 flex flex-wrap gap-3">
					<Link
						href={dashboardUrl}
						className="rounded-md bg-gray-900 px-5 py-2.5 text-sm text-white"
					>
						Get started free
					</Link>
					<Link
						href="/compare"
						className="rounded-md border border-gray-300 px-5 py-2.5 text-sm text-gray-700 hover:border-gray-400"
					>
						Compare alternatives
					</Link>
				</div>
			</section>

			{/* Footer */}
			<footer className="mt-16 border-t border-gray-200 pt-6 text-sm text-gray-500">
				Built on{" "}
				<a
					href="https://llmgateway.io"
					className="underline"
					target="_blank"
					rel="noreferrer"
				>
					LLM Gateway
				</a>
				. © llmchat.io
			</footer>
		</main>
	);
}
