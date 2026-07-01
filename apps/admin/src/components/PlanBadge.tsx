import { cx } from "@/lib/cx";

import type { Plan } from "@llmchat/shared";

const STYLES: Record<Plan, string> = {
	none: "border-line text-faint",
	starter: "border-accent/40 text-accent-soft",
	growth: "border-pos/40 text-pos",
	scale: "border-warn/40 text-warn",
};

/** Small colored chip for a workspace plan. `none` (unpaid) reads as muted. */
export function PlanBadge({ plan }: { plan: Plan }) {
	return (
		<span
			className={cx(
				"inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium capitalize",
				STYLES[plan] ?? STYLES.none,
			)}
		>
			{plan}
		</span>
	);
}
