/**
 * The problem, shown instead of described: this morning's inbox as a wall of
 * paper tickets. Three repeats stamped as auto-answered in seconds, one real
 * problem stamped as escalated to a person. The stamps carry the argument;
 * the copy around the wall just points at it.
 */

type Ticket = {
	id: string;
	time: string;
	from: string;
	q: string;
	stamp: string;
	escalated?: boolean;
	rotate: string;
};

const TICKETS: Ticket[] = [
	{
		id: "#4821",
		time: "02:11",
		from: "night owl",
		q: "How do I reset my password?",
		stamp: "Auto-answered · 3s",
		rotate: "lg:-rotate-2",
	},
	{
		id: "#4822",
		time: "04:37",
		from: "different timezone",
		q: "Where's my order? It's been two days.",
		stamp: "Auto-answered · 4s",
		rotate: "lg:rotate-1",
	},
	{
		id: "#4823",
		time: "07:58",
		from: "before your coffee",
		q: "Do you integrate with Shopify?",
		stamp: "Auto-answered · 3s",
		rotate: "lg:-rotate-1",
	},
	{
		id: "#4824",
		time: "08:15",
		from: "actually needs you",
		q: "You charged me twice and my event is on Saturday.",
		stamp: "Escalated → human · thread attached",
		escalated: true,
		rotate: "lg:rotate-2",
	},
];

export function TicketWall() {
	return (
		<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
			{TICKETS.map((t) => (
				<article
					key={t.id}
					className={`relative flex flex-col rounded-lg border bg-paper-card p-5 shadow-lift transition-transform duration-300 hover:rotate-0 ${t.rotate} ${
						t.escalated ? "border-accent/50" : "border-rule"
					}`}
				>
					{/* Perforation notch */}
					<span
						aria-hidden
						className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full border border-rule bg-paper"
					/>
					<div className="flex items-baseline justify-between font-mono text-[0.62rem] uppercase tracking-[0.12em] text-faint">
						<span>{t.id}</span>
						<span>{t.time}</span>
					</div>
					<p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-faint">
						from: {t.from}
					</p>
					<p className="font-display mt-4 flex-1 text-lg font-semibold leading-snug tracking-tight-display text-ink">
						&ldquo;{t.q}&rdquo;
					</p>
					<div
						className={`stamp mt-5 self-start ${
							t.escalated ? "-rotate-2 text-accent" : "-rotate-1 text-muted"
						}`}
					>
						{t.stamp}
					</div>
				</article>
			))}
		</div>
	);
}
