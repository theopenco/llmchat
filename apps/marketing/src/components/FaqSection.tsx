import type { Faq } from "@/lib/seo";

/**
 * Visible FAQ block, paired on each page with a `FAQPage` JSON-LD node built
 * from the same `faqs` array (Google requires the marked-up Q&As to also be
 * rendered). Uses native <details>/<summary> so it works with no JS and the
 * answers are always in the DOM for crawlers and answer engines to extract.
 *
 * Markup is deliberately not <dl>/<dt>/<dd>: that content model doesn't allow
 * <details> as a child, so a <div> list of disclosure widgets is the valid,
 * accessible structure here. The question lives in the <summary> (a real H3 so
 * the heading outline carries the query-shaped question) and the answer follows.
 */
export function FaqSection({
	faqs,
	heading = "Frequently asked questions",
}: {
	faqs: Faq[];
	heading?: string;
}) {
	if (!faqs.length) return null;

	return (
		<section className="mt-24">
			<div className="flex items-center gap-4">
				<h2 className="kicker">{heading}</h2>
				<span className="h-px flex-1 bg-rule" />
			</div>
			<div className="mt-8 divide-y divide-rule border-y border-rule">
				{faqs.map((faq) => (
					<details key={faq.question} className="group">
						<summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
							<h3 className="font-display text-lg font-semibold tracking-tight-display text-ink transition-colors group-hover:text-accent">
								{faq.question}
							</h3>
							<span
								aria-hidden
								className="font-display shrink-0 text-2xl leading-none text-faint transition-transform duration-200 group-open:rotate-45"
							>
								+
							</span>
						</summary>
						<p className="max-w-2xl pb-6 text-base leading-relaxed text-muted">
							{faq.answer}
						</p>
					</details>
				))}
			</div>
		</section>
	);
}
