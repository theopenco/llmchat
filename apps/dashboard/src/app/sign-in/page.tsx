"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/auth-layout";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { fieldErrors, signInSchema } from "@/lib/auth-schema";

export default function SignInPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [remember, setRemember] = useState(true);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const parsed = signInSchema.safeParse({ email, password });
		if (!parsed.success) {
			setErrors(fieldErrors(parsed.error));
			return;
		}
		setErrors({});
		setLoading(true);
		const res = await signIn.email({
			email: parsed.data.email,
			password: parsed.data.password,
			rememberMe: remember,
		});
		if (res.error) {
			setLoading(false);
			toast.error("Sign in failed", {
				description: res.error.message ?? undefined,
			});
			return;
		}
		track(ANALYTICS_EVENTS.signedIn, { method: "email" });
		// Hard navigation, not router.replace: the session cookie is set on the
		// API origin, so neither SSR nor the already-initialized client session
		// store reflects it yet — a soft nav lands on the dashboard with a stale
		// "logged out" store and the auth gate bounces back here (the "press
		// twice" bug). A full load re-initializes the session with the cookie
		// present. (Revisit once crossSubDomainCookies is configured for prod.)
		window.location.assign("/inbox");
	}

	return (
		<AuthLayout
			heading={<>Welcome back 👋</>}
			subheading="Sign in to your Clanker Support dashboard"
		>
			<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
							autoComplete="current-password"
							placeholder="••••••••"
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

				<label className="flex items-center gap-2 text-sm text-muted-foreground">
					<input
						type="checkbox"
						checked={remember}
						onChange={(e) => setRemember(e.target.checked)}
						className="size-4 accent-primary"
					/>
					Remember me
				</label>

				<Button type="submit" disabled={loading} className="w-full">
					{loading ? "Signing in…" : "Sign in"}
					{!loading && <ArrowRight />}
				</Button>
			</form>

			<OAuthButtons />

			<p className="mt-6 text-center text-sm text-muted-foreground">
				Don&apos;t have an account?{" "}
				<Link href="/sign-up" className="font-medium text-primary">
					Sign up
				</Link>
			</p>
		</AuthLayout>
	);
}
