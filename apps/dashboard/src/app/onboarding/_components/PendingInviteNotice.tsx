import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";

/**
 * Shown while the onboarding boot check hands an OAuth return over to its
 * stashed invitation (see invite-return.ts). The redirect fires immediately;
 * this renders instead of the paywall/build flow so the invitee never sees a
 * screen asking them to pay for a workspace they were invited to — and the
 * link is the manual path to the same place if the redirect is interrupted.
 */
export function PendingInviteNotice({ token }: { token: string }) {
	return (
		<AuthLayout
			heading={<>You&apos;ve been invited</>}
			subheading="Taking you to your invitation…"
		>
			<p className="text-sm text-muted-foreground">
				You have a pending invitation — accept it there to join your team.
			</p>
			<Button asChild className="mt-6 w-full">
				<Link href={`/invite/${encodeURIComponent(token)}`}>
					Open your invitation
					<ArrowRight />
				</Link>
			</Button>
		</AuthLayout>
	);
}
