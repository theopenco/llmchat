import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { CodeBlock } from "@/components/CodeBlock";
import { migrations, getMigration, llmchatEmbed } from "@/lib/migrations";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export function generateStaticParams() {
	return migrations.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const guide = getMigration(slug);
	if (!guide) return {};
	return {
		title: `Migrate from ${guide.name} to llmchat`,
		description: guide.intro,
	};
}

export default async function MigratePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const guide = getMigration(slug);
	if (!guide) notFound();

	const others = migrations.filter((m) => m.slug !== guide.slug);

	return (
		<main className="mx-auto max-w-5xl px-6 py-16">
			<SiteHeader active="resources" />

			{/* Breadcrumb */}
			<div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
				<Link href="/docs" className="hover:text-gray-900">
					Docs
				</Link>
				<span className="text-gray-300">/</span>
				<span className="text-gray-700">Migrate from {guide.name}</span>
			</div>

			{/* Header */}
			<section className="mt-6 max-w-3xl">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
						Migrate from {guide.name} to llmchat
					</h1>
				</div>
				<div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
					<span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
						{guide.estimatedTime}
					</span>
				</div>
				<p className="mt-4 text-lg text-gray-600">{guide.intro}</p>
			</section>

			{/* Quick migration */}
			<section className="mt-12">
				<h2 className="text-xl font-semibold">Quick migration</h2>
				<p className="mt-2 text-sm leading-relaxed text-gray-600">
					{guide.quickSummary}
				</p>
				<div className="mt-6 grid gap-4">
					<CodeBlock code={guide.oldEmbed} label={guide.oldEmbedLabel} />
					<div className="flex justify-center text-gray-400">↓</div>
					<CodeBlock code={llmchatEmbed} label="Add the llmchat widget" />
				</div>
			</section>

			{/* Migration steps */}
			<section className="mt-16">
				<h2 className="text-xl font-semibold">Migration steps</h2>
				<ol className="mt-6 space-y-8">
					{guide.steps.map((step, i) => (
						<li key={step.title} className="flex gap-4">
							<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
								{i + 1}
							</span>
							<div className="min-w-0 flex-1">
								<h3 className="font-semibold text-gray-900">{step.title}</h3>
								<p className="mt-1 text-sm leading-relaxed text-gray-600">
									{step.body}
								</p>
								{step.code && (
									<div className="mt-4">
										<CodeBlock code={step.code} label={step.codeLabel} />
									</div>
								)}
							</div>
						</li>
					))}
				</ol>
			</section>

			{/* Concept mapping */}
			<section className="mt-16">
				<h2 className="text-xl font-semibold">Concept mapping</h2>
				<p className="mt-1 text-sm text-gray-500">
					How {guide.name} concepts translate to llmchat.
				</p>
				<div className="mt-4 overflow-x-auto">
					<table className="w-full min-w-[480px] border-collapse text-left text-sm">
						<thead>
							<tr className="border-b border-gray-200">
								<th className="py-3 pr-4 text-xs font-medium uppercase tracking-wide text-gray-500">
									{guide.name}
								</th>
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-900">
									llmchat
								</th>
							</tr>
						</thead>
						<tbody>
							{guide.mapping.map((row) => (
								<tr
									key={row.from}
									className="border-b border-gray-100 hover:bg-gray-50"
								>
									<td className="py-3 pr-4 align-top text-sm text-gray-500">
										{row.from}
									</td>
									<td className="px-4 py-3 align-top text-sm text-gray-900">
										<span className="font-medium">{row.to}</span>
										{row.note && (
											<span className="mt-0.5 block text-xs text-gray-400">
												{row.note}
											</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			{/* What transfers / what doesn't */}
			<section className="mt-16">
				<h2 className="text-xl font-semibold">What to expect</h2>
				<div className="mt-6 grid gap-6 sm:grid-cols-2">
					<div className="rounded-xl border border-gray-200 p-6">
						<h3 className="font-semibold text-gray-900">Carries over</h3>
						<ul className="mt-4 space-y-2">
							{guide.transfers.map((item) => (
								<li key={item} className="flex gap-2 text-sm text-gray-600">
									<span className="mt-0.5 shrink-0 text-gray-400">✓</span>
									{item}
								</li>
							))}
						</ul>
					</div>
					<div className="rounded-xl border border-gray-200 p-6">
						<h3 className="font-semibold text-gray-900">
							Needs a separate plan
						</h3>
						<ul className="mt-4 space-y-2">
							{guide.doesntTransfer.map((item) => (
								<li key={item} className="flex gap-2 text-sm text-gray-600">
									<span className="mt-0.5 shrink-0 text-gray-300">—</span>
									{item}
								</li>
							))}
						</ul>
					</div>
				</div>
			</section>

			{/* Full comparison link */}
			<section className="mt-16 rounded-xl border border-gray-200 p-6">
				<h2 className="font-semibold">
					Want the full feature comparison first?
				</h2>
				<p className="mt-2 text-sm text-gray-600">
					See exactly how llmchat and {guide.name} stack up across setup, AI,
					channels, and pricing before you switch.
				</p>
				<Link
					href={`/vs/${guide.slug}`}
					className="mt-4 inline-block text-sm text-gray-700 underline hover:text-gray-900"
				>
					llmchat vs. {guide.name} →
				</Link>
			</section>

			{/* CTA */}
			<section className="mt-12">
				<Link
					href={dashboardUrl}
					className="rounded-md bg-gray-900 px-5 py-2.5 text-sm text-white"
				>
					Start your migration free →
				</Link>
			</section>

			{/* Other migration guides */}
			<section className="mt-16">
				<h2 className="font-semibold">Other migration guides</h2>
				<div className="mt-4 flex flex-wrap gap-2">
					{others.map((m) => (
						<Link
							key={m.slug}
							href={`/docs/migrate/${m.slug}`}
							className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-900"
						>
							From {m.name}
						</Link>
					))}
					<Link
						href="/docs"
						className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-900"
					>
						All docs →
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
