import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DOCS_URL } from "@/lib/site-urls";

// Next auto-emits <meta name="robots" content="noindex"> on not-found pages;
// this file only replaces the unbranded default UI.
export const metadata = {
	title: "Page not found — Clanker Support",
};

export default function NotFound() {
	return (
		<>
			<SiteHeader />

			<main className="mx-auto max-w-6xl px-6">
				<section className="relative overflow-hidden pt-24 pb-8 sm:pt-36">
					<div className="grid-backdrop pointer-events-none absolute inset-0" />
					<div className="relative max-w-2xl">
						<p className="kicker animate-rise-in">404 · Page not found</p>
						<h1 className="font-display animate-rise-in mt-4 text-balance text-4xl font-semibold leading-[1.04] tracking-tight-display text-ink [animation-delay:80ms] sm:text-6xl">
							This thread got lost.
						</h1>
						<p className="animate-rise-in mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted [animation-delay:140ms]">
							The page you&apos;re after doesn&apos;t exist — it may have moved,
							or the link was mistyped. Unlike our escalations, this one has no
							context attached.
						</p>
						<div className="animate-rise-in mt-8 flex flex-wrap gap-3 [animation-delay:200ms]">
							<Link
								href="/"
								className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(46,107,255,0.7)] transition-colors hover:bg-accent-deep"
							>
								Back to the homepage
								<span aria-hidden>→</span>
							</Link>
							<a
								href={DOCS_URL}
								className="rounded-full border border-rule px-7 py-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
							>
								Browse the docs
							</a>
						</div>
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
