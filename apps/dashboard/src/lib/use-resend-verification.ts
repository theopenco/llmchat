"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { sendVerificationEmail } from "./auth-client";

// Better Auth caps /send-verification-email at 3 per 60s per IP. A per-send
// cooldown keeps a normal user comfortably under that; a 429 is still handled.
const COOLDOWN_SECONDS = 30;

/**
 * Resend the email-verification link, with a cooldown so the user can't trip
 * Better Auth's rate limit. The verification link's landing is fixed server-side
 * (auth.ts overrides callbackURL), so the callbackURL passed here only satisfies
 * the endpoint and points at our own (trusted) origin.
 */
export function useResendVerification() {
	const [cooldown, setCooldown] = useState(0);
	const [sending, setSending] = useState(false);

	useEffect(() => {
		if (cooldown <= 0) return;
		const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
		return () => clearTimeout(t);
	}, [cooldown]);

	const resend = useCallback(
		async (email: string) => {
			if (!email || sending || cooldown > 0) return;
			setSending(true);
			const res = await sendVerificationEmail({
				email,
				callbackURL: `${window.location.origin}/verify-email`,
			});
			setSending(false);
			if (res.error) {
				if (res.error.status === 429) {
					toast.error("Too many requests", {
						description: "Wait a minute before requesting another link.",
					});
					setCooldown(COOLDOWN_SECONDS);
				} else {
					toast.error("Couldn't send the link", {
						description: res.error.message ?? undefined,
					});
				}
				return;
			}
			toast.success("Verification link sent", {
				description: `Check ${email}.`,
			});
			setCooldown(COOLDOWN_SECONDS);
		},
		[sending, cooldown],
	);

	return { resend, sending, cooldown };
}
