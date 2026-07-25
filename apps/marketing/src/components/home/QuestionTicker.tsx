/**
 * Marquee of the questions every support inbox answers on repeat — the pain,
 * scrolling by like a stock ticker. Decorative (aria-hidden): the ticket wall
 * below carries the same argument accessibly. The list is duplicated so the
 * -50% translate loops seamlessly; animation is killed by the global
 * reduced-motion rule in globals.css.
 */

const QUESTIONS = [
	"Where's my order?",
	"How do I reset my password?",
	"Do you have a free plan?",
	"Can I change my booking?",
	"What's your refund policy?",
	"Do you ship to Canada?",
	"Is there an API?",
	"How do I cancel?",
	"Does it work with Next.js?",
	"What sizes do you have?",
];

export function QuestionTicker() {
	const row = QUESTIONS.map((q, i) => (
		<span key={i} className="flex shrink-0 items-center gap-6">
			<span className="font-display text-lg italic text-muted">{q}</span>
			<span className="size-1 rounded-full bg-accent/60" />
		</span>
	));

	return (
		<div
			aria-hidden
			className="relative overflow-hidden border-y border-rule bg-paper-deep/60 py-3.5"
		>
			<div className="animate-marquee flex w-max gap-6 pr-6">
				{row}
				{row}
			</div>
			{/* Edge fade */}
			<div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-paper to-transparent" />
			<div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-paper to-transparent" />
		</div>
	);
}
