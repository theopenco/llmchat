import Link from "next/link";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

const features = [
	{
		title: "Drop-in widget",
		body: "One script tag. Loads in a shadow DOM so your styles never leak.",
	},
	{
		title: "Answers from your docs",
		body: "Paste in your knowledge base or system prompt. Bot stays on-topic.",
	},
	{
		title: "Escalation to humans",
		body: "When the bot can’t help, the conversation lands in your inbox with full context.",
	},
	{
		title: "Email threading",
		body: "Replies go out as email and customer responses thread back into the same conversation.",
	},
	{
		title: "Built on LLM Gateway",
		body: "Swap models without code changes. Cost and usage attribution per project.",
	},
	{
		title: "Self-hostable",
		body: "Open architecture on Ploy + D1 + KV. No surprise vendors.",
	},
];

export default function Home() {
	return (
		<main className="mx-auto max-w-5xl px-6 py-16">
			<header className="flex items-center justify-between">
				<div className="text-lg font-semibold">llmchat</div>
				<nav className="flex items-center gap-4 text-sm">
					<a href="#features" className="text-gray-600 hover:text-gray-900">
						Features
					</a>
					<Link
						href={dashboardUrl}
						className="rounded-md bg-gray-900 px-3 py-1.5 text-white"
					>
						Sign in
					</Link>
				</nav>
			</header>

			<section className="mt-20 max-w-3xl">
				<h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
					AI support that actually escalates
				</h1>
				<p className="mt-4 text-lg text-gray-600">
					Drop a single script tag on your site. The bot answers from your
					docs, hands off to your team when it can&apos;t, and threads replies
					through email — all from one inbox.
				</p>
				<div className="mt-8 flex gap-3">
					<Link
						href={dashboardUrl}
						className="rounded-md bg-gray-900 px-5 py-3 text-white"
					>
						Get started free
					</Link>
					<a
						href="#features"
						className="rounded-md border border-gray-300 px-5 py-3 text-gray-900"
					>
						See features
					</a>
				</div>
			</section>

			<section id="features" className="mt-24 grid gap-6 sm:grid-cols-2">
				{features.map((f) => (
					<div
						key={f.title}
						className="rounded-xl border border-gray-200 p-6"
					>
						<h2 className="font-semibold">{f.title}</h2>
						<p className="mt-2 text-sm text-gray-600">{f.body}</p>
					</div>
				))}
			</section>

			<footer className="mt-24 border-t border-gray-200 pt-6 text-sm text-gray-500">
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
