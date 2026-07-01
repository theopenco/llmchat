import { cx } from "@/lib/cx";

import type { ReactNode } from "react";

/** Sticky-feeling page header: title, optional subtitle, optional right slot. */
export function PageHeader({
	title,
	subtitle,
	right,
}: {
	title: string;
	subtitle?: string;
	right?: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-6 py-5 md:px-8">
			<div>
				<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
				{subtitle ? (
					<p className="mt-1 text-sm text-muted">{subtitle}</p>
				) : null}
			</div>
			{right ? <div className="flex items-center gap-2">{right}</div> : null}
		</div>
	);
}

/** A titled content card. Title renders as a console micro-label. */
export function Panel({
	title,
	right,
	children,
	className,
	bodyClassName,
}: {
	title?: string;
	right?: ReactNode;
	children: ReactNode;
	className?: string;
	bodyClassName?: string;
}) {
	return (
		<section className={cx("card p-5", className)}>
			{title || right ? (
				<div className="mb-4 flex items-center justify-between gap-3">
					{title ? <h2 className="label">{title}</h2> : <span />}
					{right}
				</div>
			) : null}
			<div className={bodyClassName}>{children}</div>
		</section>
	);
}
