import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { TrackedLink } from "@/components/TrackedLink";
import { breadcrumbLd, itemListLd, pageMeta } from "@/lib/seo";
import {
	CANONICAL_SITE_URL,
	DOCS_URL,
	RSC_NPM_URL,
	RSC_PACKAGE,
	WORDPRESS_PLUGIN_URL,
} from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export const metadata = pageMeta({
	title: "Templates — deploy the support agent in one click",
	description:
		"One-click deploy starters with the Clanker Support agent pre-wired: Next.js 15 + shadcn/ui, TanStack Start, React Router 7, Laravel, and FastAPI. Clone, set your project key, ship.",
	path: "/templates",
});

const REPO_TREE =
	"https://github.com/theopenco/clankersupport-templates/tree/main/templates";

/** The exact Vercel clone URL each template's README uses — same repo root,
 * per-template root-directory, project/repo name, and env var. */
const vercelDeploy = (dir: string, envVar: string) =>
	`https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftheopenco%2Fclankersupport-templates&env=${envVar}&envDescription=Your%20project%27s%20public%20widget%20key%20(Dashboard%20%E2%86%92%20Project%20%E2%86%92%20Embed)&envLink=https%3A%2F%2Fapp.clankersupport.com&project-name=clanker-${dir}&repository-name=clanker-${dir}&root-directory=templates/${dir}`;

interface Template {
	dir: string;
	num: string;
	name: string;
	description: string;
	tags: string[];
	deployHref: string;
	deployLabel: string;
}

const TEMPLATES: Template[] = [
	{
		dir: "nextjs-shadcn",
		num: "01",
		name: "Next.js + shadcn/ui",
		description:
			"An App Router landing page with the support agent mounted as one Server Component in the root layout.",
		tags: ["Next.js 15", "shadcn/ui", RSC_PACKAGE],
		deployHref: vercelDeploy("nextjs-shadcn", "NEXT_PUBLIC_CLANKER_KEY"),
		deployLabel: "Deploy on Vercel",
	},
	{
		dir: "tanstack-start",
		num: "02",
		name: "TanStack Start",
		description:
			"A TanStack Start site with the client widget wired through the React SDK's headless entry.",
		tags: ["TanStack Start", "Vite"],
		deployHref: vercelDeploy("tanstack-start", "VITE_CLANKER_KEY"),
		deployLabel: "Deploy on Vercel",
	},
	{
		dir: "react-router",
		num: "03",
		name: "React Router 7",
		description:
			"A server-rendered React Router 7 app with the support agent wired through the React SDK.",
		tags: ["React Router 7", "Vite", "SSR"],
		deployHref: vercelDeploy("react-router", "VITE_CLANKER_KEY"),
		deployLabel: "Deploy on Vercel",
	},
	{
		dir: "laravel",
		num: "04",
		name: "Laravel",
		description:
			"A Blade landing page rendering the embed with the official Composer package's helper.",
		tags: ["Laravel 12", "Blade", "Composer package"],
		deployHref:
			"https://railway.com/template/clanker-laravel?referralCode=clankersupport",
		deployLabel: "Deploy on Railway",
	},
	{
		dir: "fastapi",
		num: "05",
		name: "FastAPI",
		description:
			"A Jinja2-templated FastAPI site rendering the script tag with the Python package.",
		tags: ["FastAPI", "Jinja2", "pip package"],
		deployHref: vercelDeploy("fastapi", "CLANKER_PROJECT_KEY"),
		deployLabel: "Deploy on Vercel",
	},
];

interface SdkEntry {
	name: string;
	registry: string;
	href: string;
	blurb: string;
}

const SDKS: SdkEntry[] = [
	{
		name: RSC_PACKAGE,
		registry: "npm",
		href: RSC_NPM_URL,
		blurb:
			"The widget as one async Server Component for Next.js — plus a headless entry with a client widget, primitives, and a useClankerSupport hook.",
	},
	{
		name: "clankersupport/clankersupport-php",
		registry: "Packagist",
		href: "https://packagist.org/packages/clankersupport/clankersupport-php",
		blurb:
			"Renders the embed script tag from PHP, with a Laravel bridge for Blade.",
	},
	{
		name: "clankersupport",
		registry: "RubyGems",
		href: "https://rubygems.org/gems/clankersupport",
		blurb:
			"The embed script tag as a Ruby helper — drop it into any Rails or ERB layout.",
	},
	{
		name: "clankersupport",
		registry: "PyPI",
		href: "https://pypi.org/project/clankersupport/",
		blurb:
			"The embed script tag from Python — works with FastAPI, Django, or Flask templates.",
	},
	{
		name: "Clanker Support for WordPress",
		registry: "wordpress.org",
		href: WORDPRESS_PLUGIN_URL,
		blurb: "The official plugin — paste your project key in wp-admin, no code.",
	},
	{
		name: "Shopify app",
		registry: "Docs",
		href: `${DOCS_URL}/integrations/shopify`,
		blurb:
			"Install from the Shopify admin and the support agent ships with your theme.",
	},
	{
		name: "Plain <script> embed",
		registry: "Docs",
		href: DOCS_URL,
		blurb:
			"One script tag before </body> — works on any site, no build step, no framework.",
	},
];

export default function TemplatesPage() {
	return (
		<>
			<JsonLd
				data={itemListLd(
					TEMPLATES.map((t) => ({
						name: t.name,
						url: `${REPO_TREE}/${t.dir}`,
					})),
				)}
			/>
			<JsonLd
				data={breadcrumbLd(CANONICAL_SITE_URL, [
					{ name: "Home", path: "/" },
					{ name: "Templates", path: "/templates" },
				])}
			/>
			<SiteHeader active="resources" />

			<main className="mx-auto max-w-6xl px-6">
				{/* ── Hero ─────────────────────────────────────────────── */}
				<section className="relative overflow-hidden pt-16 sm:pt-20">
					<span
						aria-hidden
						className="pointer-events-none absolute -right-6 -top-10 select-none font-display text-[9rem] font-bold leading-none text-rule/70 sm:text-[14rem]"
					>
						⌥
					</span>
					<div className="relative">
						<p className="kicker animate-rise-in">
							Templates · One-click deploy
						</p>
						<h1 className="font-display animate-rise-in mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.04] tracking-tight-display text-ink [animation-delay:80ms] sm:text-6xl">
							Start with the support agent already wired in.
						</h1>
						<p className="animate-rise-in mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted [animation-delay:140ms]">
							Five small, production-clean starters — Next.js, TanStack Start,
							React Router, Laravel, and FastAPI — each with the support agent
							installed the official way for that stack. Deploy one, set your
							project key, and it&apos;s answering.
						</p>
					</div>
				</section>

				{/* ── Template grid ────────────────────────────────────── */}
				<section className="animate-rise-in mt-14 [animation-delay:220ms]">
					<div className="grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule sm:grid-cols-2">
						{TEMPLATES.map((t) => (
							<article
								key={t.dir}
								className="group relative flex flex-col overflow-hidden bg-paper p-8 transition-colors hover:bg-paper-card sm:p-10"
							>
								<span
									aria-hidden
									className="pointer-events-none absolute -right-3 -top-8 select-none font-display text-[7rem] font-bold leading-none text-rule/60 transition-colors group-hover:text-accent/10"
								>
									{t.num}
								</span>
								<div className="relative flex flex-1 flex-col">
									<span className="font-mono text-xs font-medium text-faint transition-colors group-hover:text-accent-soft">
										{t.num}
									</span>
									<h2 className="font-display mt-4 text-2xl font-semibold tracking-tight-display text-ink">
										{t.name}
									</h2>
									<p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
										{t.description}
									</p>
									<ul className="mt-5 flex flex-wrap gap-2">
										{t.tags.map((tag) => (
											<li
												key={tag}
												className="rounded-full border border-rule bg-paper-raise px-3 py-1 font-mono text-[0.66rem] tracking-[0.04em] text-ink-soft"
											>
												{tag}
											</li>
										))}
									</ul>
									<div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 pt-px">
										<TrackedLink
											href={t.deployHref}
											target="_blank"
											rel="noopener noreferrer"
											event={ANALYTICS_EVENTS.ctaClicked}
											eventProps={{
												source: "templates_deploy",
												template: t.dir,
											}}
											className="rounded-full bg-ink px-5 py-2.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent"
										>
											{t.deployLabel}
										</TrackedLink>
										<a
											href={`${REPO_TREE}/${t.dir}`}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
										>
											Source on GitHub
											<span aria-hidden>↗</span>
										</a>
									</div>
								</div>
							</article>
						))}
					</div>
				</section>

				{/* ── SDKs & integrations ──────────────────────────────── */}
				<section className="mt-24">
					<div className="flex items-center gap-4">
						<h2 className="kicker">SDKs &amp; integrations</h2>
						<span className="h-px flex-1 bg-rule" />
					</div>
					<p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-soft">
						Not starting from a template? The same support agent installs into
						the stack you already have — a package per ecosystem, each rendering
						the identical embed.
					</p>
					<ul className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule sm:grid-cols-2">
						{SDKS.map((s) => (
							<li key={s.href} className="bg-paper">
								<a
									href={s.href}
									target="_blank"
									rel="noopener noreferrer"
									className="group flex h-full flex-col p-6 transition-colors hover:bg-paper-card sm:p-7"
								>
									<span className="flex items-baseline justify-between gap-4">
										<span className="break-all font-mono text-sm font-medium text-ink">
											{s.name}
										</span>
										<span className="shrink-0 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-faint transition-colors group-hover:text-accent-soft">
											{s.registry} ↗
										</span>
									</span>
									<span className="mt-2 block text-sm leading-relaxed text-muted">
										{s.blurb}
									</span>
								</a>
							</li>
						))}
					</ul>
				</section>

				{/* ── Key CTA ──────────────────────────────────────────── */}
				<section className="mt-24 mb-24 flex flex-col items-start justify-between gap-5 rounded-3xl border-l-2 border-accent bg-paper-deep/60 p-7 sm:flex-row sm:items-center">
					<div className="max-w-xl">
						<h2 className="font-display text-2xl font-semibold tracking-tight-display text-ink">
							Every template asks for one thing: a project key.
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-muted">
							Create a project, grab the public key from its Embed page, and
							paste it into the deploy form. The docs cover the rest — knowledge
							sources, branding, and escalation to your team.
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap gap-3">
						<TrackedLink
							href={dashboardUrl}
							event={ANALYTICS_EVENTS.signupStarted}
							eventProps={{ source: "templates_cta" }}
							className="rounded-full bg-ink px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent"
						>
							Get your key
						</TrackedLink>
						<a
							href={DOCS_URL}
							className="rounded-full border border-rule px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
						>
							Read the docs
						</a>
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
