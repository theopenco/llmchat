"use client";

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
			<div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-rule bg-paper-card/95 p-5 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
				<p className="text-sm leading-relaxed text-ink-soft">
					We use analytics cookies to understand how the site is used and
					improve it. Nothing is loaded until you accept.
				</p>
				<div className="flex shrink-0 gap-3">
					<button
						type="button"
						onClick={onDecline}
						className="rounded-full border border-rule px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
					>
						Decline
					</button>
					<button
						type="button"
						onClick={onAccept}
						className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
					>
						Accept
					</button>
				</div>
			</div>
		</div>
	);
}
