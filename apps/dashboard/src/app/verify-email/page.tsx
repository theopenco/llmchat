"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Mail } from "lucide-react";

import { AuthLayout } from "@/components/auth-layout";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth-client";
import { useResendVerification } from "@/lib/use-resend-verification";

function VerifyEmailInner() {
	const params = useSearchParams();
	const error = params.get("error");
	const { data: session, isPending } = useSession();
	const { resend, sending, cooldown } = useResendVerification();
	const [email, setEmail] = useState("");
	const [stalled, setStalled] = useState(false);

	// Success path: no ?error means Better Auth verified the token and (via
	// autoSignInAfterVerification) set a session before redirecting here. The
	// cookie was set on the API origin during the server redirect; this full page
	// load re-inits the client session store, so a hard nav lands cleanly.
	useEffect(() => {
		if (error) return;
		if (!isPending && session) window.location.assign("/onboarding");
	}, [error, isPending, session]);

	// Don't hang forever if the session never resolves (autoSignIn edge).
	useEffect(() => {
		if (error) return;
		const t = setTimeout(() => setStalled(true), 4000);
		return () => clearTimeout(t);
	}, [error]);

	if (!error) {
		if (!isPending && !session && stalled) {
			return (
				<AuthLayout heading="Email verified" subheading="You can sign in now">
					<div className="flex flex-col items-center gap-4 py-4 text-center">
						<p className="text-sm text-muted-foreground">
							Your email is verified. Please sign in to continue.
						</p>
						<Button
							type="button"
							className="w-full"
							onClick={() => window.location.assign("/sign-in")}
						>
							Go to sign in
						</Button>
					</div>
				</AuthLayout>
			);
		}
		return (
			<AuthLayout
				heading="Email verified"
				subheading="Taking you to your dashboard…"
			>
				<div className="flex flex-col items-center gap-4 py-8 text-center">
					<Loader2 className="size-6 animate-spin text-primary" />
					<p className="text-sm text-muted-foreground">
						You&apos;re verified. Redirecting…
					</p>
				</div>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout
			heading="That link didn't work"
			subheading="Request a fresh verification link"
		>
			<div className="flex flex-col gap-4">
				<div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-left">
					<AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
					<p className="text-sm">
						This verification link has expired or was already used. Enter your
						email and we&apos;ll send a new one.
					</p>
				</div>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void resend(email);
					}}
					className="flex flex-col gap-3"
				>
					<FormField id="email" label="Email">
						<div className="relative">
							<Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								id="email"
								type="email"
								autoComplete="email"
								placeholder="you@company.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="pl-9"
							/>
						</div>
					</FormField>
					<Button
						type="submit"
						className="w-full"
						disabled={sending || cooldown > 0 || !email}
					>
						{cooldown > 0
							? `Resend in ${cooldown}s`
							: sending
								? "Sending…"
								: "Send a new link"}
					</Button>
				</form>
			</div>
		</AuthLayout>
	);
}

export default function VerifyEmailPage() {
	return (
		<Suspense fallback={null}>
			<VerifyEmailInner />
		</Suspense>
	);
}
