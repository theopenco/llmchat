import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The single content container for dashboard content pages — Projects, Sources,
 * Settings, Billing, Account, Workspaces. Fills the width available after the
 * sidebar with consistent horizontal padding, capping + centering only on
 * ultra-wide monitors. Replaces the per-page narrow `mx-auto max-w-*` columns
 * (768–1040px) that left large left/right gaps, so every page lines up the same.
 *
 * NOT used by the inbox: that surface is a full-width three-pane with the
 * bounded full-height layout the shell owns (h-full inside main), so it debars
 * the padded/max-width container by design.
 *
 * `max-w-[1600px]` fills typical laptop/desktop widths edge-to-edge after the
 * sidebar and only caps on genuinely wide displays; `px-6 sm:px-8` is the shared
 * gutter, `py-8` the shared vertical rhythm.
 */
export function PageContainer({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"mx-auto w-full max-w-[1600px] px-6 py-8 sm:px-8",
				className,
			)}
		>
			{children}
		</div>
	);
}
