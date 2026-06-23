"use client";

import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useResendVerification } from "@/lib/use-resend-verification";

/**
 * "Check your email" panel shown after sign-up (and reused on the sign-in
 * unverified path). The visitor must confirm they own the address before they
 * get a session — Better Auth issues none until the link is clicked.
 */
export function VerifyEmailNotice({
	email,
	body,
}: {
	email: string;
	body: string;
}) {
	const { resend, sending, cooldown } = useResendVerification();
	return (
		<div className="flex flex-col items-center gap-5 py-2 text-center">
			<div className="flex size-12 items-center justify-center rounded-full bg-primary/15">
				<MailCheck className="size-6 text-primary" />
			</div>
			<div className="space-y-1.5">
				<p className="text-sm text-muted-foreground">{body}</p>
				<p className="text-sm font-medium break-all">{email}</p>
			</div>
			<div className="w-full space-y-2">
				<Button
					type="button"
					variant="outline"
					className="w-full"
					disabled={sending || cooldown > 0}
					onClick={() => resend(email)}
				>
					{cooldown > 0
						? `Resend link in ${cooldown}s`
						: sending
							? "Sending…"
							: "Resend link"}
				</Button>
				<p className="text-xs text-muted-foreground">
					Wrong address or didn&apos;t arrive? Resend, or check your spam
					folder.
				</p>
			</div>
		</div>
	);
}
