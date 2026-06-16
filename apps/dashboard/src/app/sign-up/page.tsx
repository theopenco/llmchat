"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth-card";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUp } from "@/lib/auth-client";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { fieldErrors, signUpSchema } from "@/lib/auth-schema";

export default function SignUpPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
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
		setLoading(false);
		if (res.error) {
			toast.error("Sign up failed", {
				description: res.error.message ?? undefined,
			});
			return;
		}
		track(ANALYTICS_EVENTS.signupCompleted, { method: "email" });
		// New account → straight into onboarding (workspace is provisioned server-side).
		router.replace("/onboarding");
	}

	return (
		<AuthCard
			title="Create account"
			description="Get started with llmchat in seconds."
		>
			<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
				<FormField id="name" label="Name (optional)" error={errors.name}>
					<Input
						id="name"
						placeholder="Jane Doe"
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				</FormField>
				<FormField id="email" label="Email" error={errors.email}>
					<Input
						id="email"
						type="email"
						autoComplete="email"
						placeholder="you@company.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						aria-invalid={Boolean(errors.email)}
					/>
				</FormField>
				<FormField id="password" label="Password" error={errors.password}>
					<Input
						id="password"
						type="password"
						autoComplete="new-password"
						placeholder="8+ characters"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						aria-invalid={Boolean(errors.password)}
					/>
				</FormField>
				<Button type="submit" disabled={loading} className="w-full">
					{loading ? "Creating…" : "Create account"}
				</Button>
				<p className="text-center text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link
						href="/sign-in"
						className="font-medium text-foreground underline"
					>
						Sign in
					</Link>
				</p>
			</form>
		</AuthCard>
	);
}
