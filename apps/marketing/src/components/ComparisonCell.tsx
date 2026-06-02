import type { Rating } from "@/lib/competitors";

export function ComparisonCell({
	value,
	highlight,
}: {
	value: Rating;
	highlight?: boolean;
}) {
	if (value === "yes")
		return (
			<span
				className={`text-sm ${highlight ? "font-semibold text-gray-900" : "text-gray-700"}`}
			>
				✓
			</span>
		);
	if (value === "no")
		return <span className="text-sm text-gray-300">—</span>;
	if (value === "partial")
		return (
			<span
				className={`text-sm ${highlight ? "text-gray-700" : "text-gray-400"}`}
			>
				~
			</span>
		);
	return (
		<span
			className={`text-xs ${highlight ? "font-medium text-gray-900" : "text-gray-600"}`}
		>
			{value}
		</span>
	);
}
