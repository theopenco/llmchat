export function ComparisonCell({
	value,
	highlight,
}: {
	value: string;
	highlight?: boolean;
}) {
	if (value === "yes")
		return (
			<span className={highlight ? "text-accent" : "text-ink"} aria-label="yes">
				✓
			</span>
		);
	if (value === "no")
		return (
			<span className="text-faint" aria-label="no">
				–
			</span>
		);
	if (value === "partial")
		return (
			<span className="text-muted" aria-label="partial">
				~
			</span>
		);
	return (
		<span
			className={`font-mono text-[0.7rem] leading-snug ${
				highlight ? "text-ink" : "text-muted"
			}`}
		>
			{value}
		</span>
	);
}
