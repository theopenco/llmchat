"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { signOut } from "@/lib/auth-client";
import { track, resetAnalytics, ANALYTICS_EVENTS } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

export function UserMenu({ email }: { email: string }) {
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	async function handleSignOut() {
		setLoading(true);
		// Attribute the event to the still-identified user, then reset.
		track(ANALYTICS_EVENTS.signedOut);
		try {
			await signOut();
			resetAnalytics();
			router.replace("/sign-in");
		} catch (e) {
			setLoading(false);
			toast.error("Sign out failed", {
				description: e instanceof Error ? e.message : undefined,
			});
		}
	}

	return (
		<div className="flex items-center gap-2">
			<span className="hidden max-w-[18ch] truncate text-sm text-muted-foreground sm:inline">
				{email}
			</span>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={handleSignOut}
				disabled={loading}
				className="text-muted-foreground hover:text-foreground"
			>
				<LogOut className="size-4" />
				<span className="hidden sm:inline">
					{loading ? "Signing out…" : "Sign out"}
				</span>
			</Button>
		</div>
	);
}
