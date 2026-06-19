"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/auth-layout";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUp } from "@/lib/auth-client";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { fieldErrors, signUpSchema } from "@/lib/auth-schema";

export default function SignUpPage() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const parsed = signUpSchema.safeParse({
			name: name.trim() || undefined,
			email,
			password,
		});
		if (!parsed.success) {
			setErrors(fieldErrors(parsed.error));
			return;
		}
		setErrors({});
		setLoading(true);
		// Name is optional in the UI but required downstream — derive a stable one
		// from the email when blank.
		const displayName = parsed.data.name || email.split("@")[0] || "there";
		const res = await signUp.email({
			email: parsed.data.email,
			password: parsed.data.password,
			name: displayName,
		});
		if (res.error) {
			setLoading(false);
			toast.error("Sign up failed", {
				description: res.error.message ?? undefined,
			});
			return;
		}
		track(ANALYTICS_EVENTS.signupCompleted, { method: "email" });
		// New account → straight into onboarding (workspace is provisioned
		// server-side). Hard navigation, not router.replace: the session cookie
		// is set on the API origin, so the client session store on this page is
		// still "logged out" — a soft nav lands on /onboarding with a stale store
		// and its auth gate bounces back to sign-in. A full load re-initializes
		// the session with the cookie present.
		window.location.assign("/onboarding");
	}

	return (
		<AuthLayout
			heading="Create your account"
			subheading="Get started with Clanker Support in seconds"
		>
			<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
				<FormField id="name" label="Name (optional)" error={errors.name}>
					<div className="relative">
						<User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="name"
							placeholder="Jane Doe"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="pl-9"
						/>
					</div>
				</FormField>
				<FormField id="email" label="Email" error={errors.email}>
					<div className="relative">
						<Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="email"
							type="email"
							autoComplete="email"
							placeholder="you@company.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							aria-invalid={Boolean(errors.email)}
							className="pl-9"
						/>
					</div>
				</FormField>
				<FormField id="password" label="Password" error={errors.password}>
					<div className="relative">
						<Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="password"
							type={showPassword ? "text" : "password"}
							autoComplete="new-password"
							placeholder="8+ characters"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							aria-invalid={Boolean(errors.password)}
							className="px-9"
						/>
						<button
							type="button"
							onClick={() => setShowPassword((v) => !v)}
							aria-label={showPassword ? "Hide password" : "Show password"}
							className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
						>
							{showPassword ? (
								<EyeOff className="size-4" />
							) : (
								<Eye className="size-4" />
							)}
						</button>
					</div>
				</FormField>

				<Button type="submit" disabled={loading} className="w-full">
					{loading ? "Creating…" : "Create account"}
					{!loading && <ArrowRight />}
				</Button>
			</form>

			<OAuthButtons />

			<p className="mt-6 text-center text-sm text-muted-foreground">
				Already have an account?{" "}
				<Link href="/sign-in" className="font-medium text-primary">
					Sign in
				</Link>
			</p>
		</AuthLayout>
	);
}
