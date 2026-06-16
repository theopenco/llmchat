"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useSession } from "@/lib/auth-client";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import {
	CANONICAL_DASHBOARD_URL,
	resolveForCurrentHost,
} from "@/lib/site-urls";

/**
 * Flips between "Sign in" and "Dashboard" based on the cross-app session.
 * `variant="primary"` is the filled indigo button (header / hero); `"ghost"`
 * is a quieter inline link.
 */
export function AuthButton({
	variant = "primary",
	className = "",
}: {
	variant?: "primary" | "ghost";
	className?: string;
}) {
	const { data, isPending } = useSession();
	const signedIn = !!data?.user;

	// Resolve after mount so preview hosts link to their preview dashboard.
	// Starts at the canonical URL to keep server/client markup in sync.
	const [href, setHref] = useState(CANONICAL_DASHBOARD_URL);
	useEffect(() => {
		setHref(resolveForCurrentHost(CANONICAL_DASHBOARD_URL));
	}, []);

	const label = signedIn ? "Dashboard" : "Sign in";
	const event = signedIn
		? ANALYTICS_EVENTS.ctaClicked
		: ANALYTICS_EVENTS.ctaClicked;

	const base =
		variant === "primary"
			? "inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] transition-colors hover:bg-accent-deep"
			: "inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink";

	return (
		<Link
			href={href}
			onClick={() =>
				track(event, {
					label: signedIn ? "open_dashboard" : "sign_in",
					location: "header",
				})
			}
			// Avoid a flash of the wrong label before the session resolves.
			data-loading={isPending ? "" : undefined}
			className={`${base} ${className}`}
		>
			{label}
			{signedIn && <span aria-hidden>↗</span>}
		</Link>
	);
}
