import { JsonLd } from "@/components/JsonLd";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { breadcrumbLd } from "@/lib/seo";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

/**
 * Shared chrome for long-form legal pages (privacy policy, terms). Renders the
 * site header/footer, a titled header with a "last updated" stamp, and a
 * `.prose-editorial` container so the body reads like the rest of the site's
 * long-form content. Pass the document body as children (semantic h2/h3/p/ul).
 */
export function LegalPage({
	title,
	path,
	lastUpdated,
	intro,
	children,
}: {
	title: string;
	/** Root-relative page path, for the breadcrumb trail. */
	path: string;
	lastUpdated: string;
	intro: string;
	children: React.ReactNode;
}) {
	return (
		<>
			<JsonLd
				data={breadcrumbLd(CANONICAL_SITE_URL, [
					{ name: "Home", path: "/" },
					{ name: title, path },
				])}
			/>
			<SiteHeader />
			<main className="mx-auto max-w-3xl px-6">
				<header className="pt-16">
					<p className="kicker">Legal</p>
					<h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] tracking-tight-display text-ink sm:text-5xl">
						{title}
					</h1>
					<p className="mt-5 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-faint">
						Last updated · {lastUpdated}
					</p>
					<p className="mt-6 text-pretty text-lg leading-relaxed text-muted">
						{intro}
					</p>
				</header>

				<div className="prose-editorial mt-12 pb-8">{children}</div>
			</main>
			<SiteFooter />
		</>
	);
}
