import Link from "next/link";
import { Fragment } from "react";
import {
	colOrder,
	colLabels,
	featureGroups,
	competitors,
} from "@/lib/competitors";
import { ComparisonCell } from "@/components/ComparisonCell";
import { SiteHeader } from "@/components/SiteHeader";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export const metadata = {
	title: "llmchat vs. alternatives — Compare AI support tools",
	description:
		"See how llmchat compares to Chatbase, Fin, Intercom, Chatwoot, and Crisp across setup, AI capabilities, escalation, channels, and pricing.",
};

export default function ComparePage() {
	return (
		<main className="mx-auto max-w-5xl px-6 py-16">
			<SiteHeader active="compare" />

			{/* Hero */}
			<section className="mt-16 max-w-3xl">
				<h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
					llmchat vs. the alternatives
				</h1>
				<p className="mt-4 text-lg text-gray-600">
					How llmchat compares to Chatbase, Fin, Intercom, Chatwoot, and Crisp.
					We've tried to be honest — including where the others are stronger.
				</p>
			</section>

			{/* TL;DR */}
			<section className="mt-12 rounded-xl border border-gray-200 p-6">
				<h2 className="font-semibold">TL;DR</h2>
				<p className="mt-2 text-sm leading-relaxed text-gray-600">
					llmchat is the right choice if you want a{" "}
					<strong className="text-gray-900">single script tag</strong> that
					handles AI support, smart escalation, and email threading — with the
					ability to{" "}
					<strong className="text-gray-900">
						swap underlying models without code changes
					</strong>{" "}
					and{" "}
					<strong className="text-gray-900">
						self-host on your own infrastructure
					</strong>
					. If you need WhatsApp, voice, or enterprise multi-channel support
					today, Intercom, Chatwoot, or Chatbase are the stronger options.
				</p>
			</section>

			{/* Feature table */}
			<section className="mt-12">
				<h2 className="font-semibold">Feature comparison</h2>
				<p className="mt-1 text-sm text-gray-500">
					✓ supported &nbsp;·&nbsp; — not available &nbsp;·&nbsp; ~ partial
					support
				</p>

				<div className="mt-4 overflow-x-auto">
					<table className="w-full min-w-[760px] border-collapse text-left text-sm">
						<thead>
							<tr className="border-b border-gray-200">
								<th className="w-48 py-3 pr-4 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
									Feature
								</th>
								{colOrder.map((col) => (
									<th
										key={col}
										className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wide ${
											col === "llmchat" ? "text-gray-900" : "text-gray-500"
										}`}
									>
										{col === "llmchat" ? (
											colLabels[col]
										) : (
											<Link
												href={`/vs/${col}`}
												className="hover:text-gray-900 hover:underline"
											>
												{colLabels[col]}
											</Link>
										)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{featureGroups.map((group) => (
								<Fragment key={group.heading}>
									<tr className="border-b border-gray-100">
										<td
											colSpan={7}
											className="bg-gray-50 py-2 pl-1 text-xs font-semibold uppercase tracking-wide text-gray-500"
										>
											{group.heading}
										</td>
									</tr>
									{group.rows.map((row) => (
										<tr
											key={row.label}
											className="border-b border-gray-100 hover:bg-gray-50"
										>
											<td className="py-3 pr-4 text-sm text-gray-700">
												{row.label}
												{row.note && (
													<p className="mt-0.5 text-xs text-gray-400">
														{row.note}
													</p>
												)}
											</td>
											{colOrder.map((col) => (
												<td
													key={col}
													className={`px-4 py-3 text-center ${
														col === "llmchat" ? "bg-gray-50" : ""
													}`}
												>
													<ComparisonCell
														value={row[col]}
														highlight={col === "llmchat"}
													/>
												</td>
											))}
										</tr>
									))}
								</Fragment>
							))}
						</tbody>
					</table>
				</div>
			</section>

			{/* Competitor cards */}
			<section className="mt-16">
				<h2 className="font-semibold">About each alternative</h2>
				<div className="mt-6 grid gap-6 sm:grid-cols-2">
					{competitors.map((c) => (
						<div key={c.id} className="rounded-xl border border-gray-200 p-6">
							<div className="flex items-start justify-between gap-4">
								<div>
									<h3 className="font-semibold">{c.name}</h3>
									<p className="text-xs text-gray-500">{c.tagline}</p>
								</div>
								<a
									href={c.url}
									target="_blank"
									rel="noreferrer"
									className="shrink-0 text-xs text-gray-400 underline hover:text-gray-700"
								>
									Visit ↗
								</a>
							</div>
							<p className="mt-3 text-sm leading-relaxed text-gray-600">
								{c.description}
							</p>
							<div className="mt-4 space-y-2 text-xs">
								<div>
									<span className="font-medium text-gray-700">Best for: </span>
									<span className="text-gray-600">{c.bestFor}</span>
								</div>
								<div>
									<span className="font-medium text-gray-700">
										Not ideal for:{" "}
									</span>
									<span className="text-gray-600">{c.notFor}</span>
								</div>
								<div>
									<span className="font-medium text-gray-700">Pricing: </span>
									<span className="text-gray-600">{c.pricing}</span>
								</div>
							</div>
							<Link
								href={`/vs/${c.id}`}
								className="mt-4 block text-xs text-gray-500 hover:text-gray-900"
							>
								Full comparison: llmchat vs. {c.name} →
							</Link>
						</div>
					))}
				</div>
			</section>

			{/* CTA */}
			<section className="mt-16 rounded-xl border border-gray-200 p-8">
				<h2 className="text-xl font-semibold">Try llmchat free</h2>
				<p className="mt-2 text-sm text-gray-600">
					One script tag. No credit card. See if it fits before committing.
				</p>
				<div className="mt-6 flex flex-wrap gap-3">
					<Link
						href={dashboardUrl}
						className="rounded-md bg-gray-900 px-5 py-2.5 text-sm text-white"
					>
						Get started free
					</Link>
					<Link
						href="/blog"
						className="rounded-md border border-gray-300 px-5 py-2.5 text-sm text-gray-700 hover:border-gray-400"
					>
						Read the blog
					</Link>
				</div>
			</section>

			{/* Footer */}
			<footer className="mt-16 border-t border-gray-200 pt-6">
				<div className="flex flex-wrap gap-x-8 gap-y-4 text-xs text-gray-500">
					<div>
						<p className="font-medium text-gray-700">llmchat vs.</p>
						<ul className="mt-2 space-y-1">
							{competitors.map((c) => (
								<li key={c.id}>
									<Link
										href={`/vs/${c.id}`}
										className="hover:text-gray-900 hover:underline"
									>
										llmchat vs. {c.name}
									</Link>
								</li>
							))}
						</ul>
					</div>
					<div className="flex-1" />
					<p className="self-end">
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
					</p>
				</div>
			</footer>
		</main>
	);
}
