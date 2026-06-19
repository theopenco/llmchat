"use client";

import { Button } from "@/components/ui/button";

/**
 * Cookie-consent banner for EU/EEA + UK visitors. Rendered by the
 * PostHogProvider only when a decision is required and none has been made yet;
 * the provider owns all consent state and PostHog init — this is presentation
 * plus two callbacks.
 */
export function ConsentBanner({
	onAccept,
	onDecline,
}: {
	onAccept: () => void;
	onDecline: () => void;
}) {
	return (
		<div
			role="dialog"
			aria-live="polite"
			aria-label="Cookie consent"
			className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
		>
			<div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
				<p className="text-sm leading-relaxed text-muted-foreground">
					We use privacy-friendly analytics to understand product usage and
					improve it. No data is collected until you accept.
				</p>
				<div className="flex shrink-0 gap-3">
					<Button variant="outline" size="sm" onClick={onDecline}>
						Decline
					</Button>
					<Button size="sm" onClick={onAccept}>
						Accept
					</Button>
				</div>
			</div>
		</div>
	);
}
