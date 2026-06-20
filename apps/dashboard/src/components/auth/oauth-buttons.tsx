"use client";

import { useQuery } from "@tanstack/react-query";
import { Github } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	fetchOAuthProviders,
	startSocialSignIn,
	type SocialProvider,
} from "@/lib/oauth";

/** Google "G" — lucide has no brand glyph, so a tiny inline mark. */
function GoogleMark() {
	return (
		<svg viewBox="0 0 24 24" className="size-4" aria-hidden>
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
			/>
			<path
				fill="#FBBC05"
				d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
			/>
			<path
				fill="#EA4335"
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
			/>
		</svg>
	);
}

function ProviderButton({
	icon,
	label,
	enabled,
	loading,
	pending,
	onClick,
}: {
	icon: React.ReactNode;
	label: string;
	/** The provider is configured server-side. */
	enabled: boolean;
	/** Still resolving which providers are configured. */
	loading: boolean;
	/** A sign-in for this provider is in flight (redirecting). */
	pending: boolean;
	onClick: () => void;
}) {
	// "Soon" only once we KNOW it's unconfigured — never flash it while loading.
	const showSoon = !loading && !enabled;
	return (
		<Button
			type="button"
			variant="outline"
			className="w-full justify-center gap-2"
			disabled={!enabled || pending}
			title={enabled ? undefined : "Social sign-in is coming soon"}
			onClick={onClick}
		>
			{icon}
			{pending ? "Connecting…" : `Continue with ${label}`}
			{showSoon && (
				<span className="ml-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
					Soon
				</span>
			)}
		</Button>
	);
}

/**
 * Social sign-in buttons. Each provider is enabled only when the API reports its
 * credentials are configured (/api/oauth-providers); otherwise it stays disabled
 * with a "Soon" marker — no dead action. Clicking starts Better Auth's hosted
 * OAuth flow, which lands the user in /onboarding like an email sign-up.
 */
export function OAuthButtons() {
	const { data, isLoading } = useQuery({
		queryKey: ["oauth-providers"],
		queryFn: fetchOAuthProviders,
		staleTime: 5 * 60_000,
	});
	const [pending, setPending] = useState<SocialProvider | null>(null);

	async function handle(provider: SocialProvider) {
		setPending(provider);
		try {
			const res = await startSocialSignIn(provider);
			// On success the client redirects to the provider, so this only runs on
			// an error response — re-enable and surface it.
			if (res?.error) {
				toast.error(res.error.message ?? "Couldn't start sign-in");
				setPending(null);
			}
		} catch {
			toast.error("Couldn't start sign-in. Please try again.");
			setPending(null);
		}
	}

	return (
		<div className="mt-6">
			<div className="flex items-center gap-3">
				<span className="h-px flex-1 bg-border" />
				<span className="text-xs text-muted-foreground">OR</span>
				<span className="h-px flex-1 bg-border" />
			</div>
			<div className="mt-6 flex flex-col gap-3">
				<ProviderButton
					icon={<GoogleMark />}
					label="Google"
					enabled={!!data?.google}
					loading={isLoading}
					pending={pending === "google"}
					onClick={() => handle("google")}
				/>
				<ProviderButton
					icon={<Github className="size-4" />}
					label="GitHub"
					enabled={!!data?.github}
					loading={isLoading}
					pending={pending === "github"}
					onClick={() => handle("github")}
				/>
			</div>
		</div>
	);
}
