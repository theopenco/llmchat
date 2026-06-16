"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { track, type AnalyticsProps } from "@/lib/analytics";

type TrackedLinkProps = ComponentProps<typeof Link> & {
	event: string;
	eventProps?: AnalyticsProps;
};

/** A next/link that fires an analytics event on click. */
export function TrackedLink({
	event,
	eventProps,
	onClick,
	...props
}: TrackedLinkProps) {
	return (
		<Link
			{...props}
			onClick={(e) => {
				track(event, eventProps);
				onClick?.(e);
			}}
		/>
	);
}
