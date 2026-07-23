"use client";

import Link from "next/link";

import { useSession } from "@/lib/auth-client";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { CANONICAL_DASHBOARD_URL, SIGNUP_URL } from "@/lib/site-urls";

const primary =
	"inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(46,107,255,0.6)] transition-colors hover:bg-accent-deep";
const ghost =
	"inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink";

/**
 * Signed out: a quiet "Sign in" link plus the filled "Start free trial"
 * button pointing at the dashboard's /sign-up page — the header's primary
 * action is account creation, not login. Signed in: a single "Dashboard"
 * button. "Sign in" hides on the narrowest screens so the trial CTA and the
 * mobile nav never fight for space.
 */
export function AuthButton({ className = "" }: { className?: string }) {
	const { data, isPending } = useSession();
	const signedIn = !!data?.user;

	if (signedIn) {
		return (
			<Link
				href={CANONICAL_DASHBOARD_URL}
				onClick={() =>
					track(ANALYTICS_EVENTS.ctaClicked, {
						label: "open_dashboard",
						location: "header",
					})
				}
				className={`${primary} ${className}`}
			>
				Dashboard
				<span aria-hidden>↗</span>
			</Link>
		);
	}

	return (
		<span
			className={`inline-flex items-center gap-3.5 ${className}`}
			// Avoid a flash of the wrong actions before the session resolves.
			data-loading={isPending ? "" : undefined}
		>
			<Link
				href={CANONICAL_DASHBOARD_URL}
				onClick={() =>
					track(ANALYTICS_EVENTS.ctaClicked, {
						label: "sign_in",
						location: "header",
					})
				}
				className={`${ghost} hidden min-[420px]:inline-flex`}
			>
				Sign in
			</Link>
			<Link
				href={SIGNUP_URL}
				onClick={() =>
					track(ANALYTICS_EVENTS.signupStarted, { source: "header" })
				}
				className={primary}
			>
				Start free trial
			</Link>
		</span>
	);
}
