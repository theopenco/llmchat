import type { CSSProperties, ReactNode } from "react";
import { TrackedLink } from "@/components/TrackedLink";

/**
 * The hero CTA with Magic UI's shimmer treatment, rebuilt around TrackedLink
 * so the analytics contract stays byte-identical (same event, same source).
 * Pure CSS — no client JS beyond TrackedLink's existing click handler; the
 * shimmer honors the global prefers-reduced-motion kill-switch.
 */
export function ShimmerCta({
	href,
	event,
	eventProps,
	children,
}: {
	href: string;
	event: string;
	eventProps: Record<string, string>;
	children: ReactNode;
}) {
	return (
		<span
			style={
				{
					"--spread": "90deg",
					"--shimmer-color": "#dbe6ff",
					"--speed": "3.2s",
					"--cut": "0.06em",
					"--bg": "#2E6BFF",
				} as CSSProperties
			}
			className="group relative z-0 inline-flex overflow-hidden rounded-full [background:var(--bg)] shadow-[0_10px_30px_-8px_rgba(46,107,255,0.7)] transition-transform duration-300 active:translate-y-px"
		>
			<span
				aria-hidden
				className="absolute inset-0 -z-30 overflow-visible blur-[2px] [container-type:size]"
			>
				<span className="animate-shimmer-slide absolute inset-0 block aspect-square h-[100cqh] rounded-none">
					<span className="animate-spin-around absolute -inset-full block w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
				</span>
			</span>
			<span
				aria-hidden
				className="absolute inset-[var(--cut)] -z-20 rounded-full [background:var(--bg)]"
			/>
			<TrackedLink
				href={href}
				event={event}
				eventProps={eventProps}
				className="relative z-10 inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white"
			>
				{children}
			</TrackedLink>
		</span>
	);
}
