"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth-card";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";
import { fieldErrors, signInSchema } from "@/lib/auth-schema";

export default function SignInPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
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
		});
		setLoading(false);
		if (res.error) {
			toast.error("Sign in failed", {
				description: res.error.message ?? undefined,
			});
			return;
		}
		router.replace("/inbox");
	}

	return (
		<AuthCard title="Sign in" description="Welcome back to llmchat.">
			<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
						autoComplete="current-password"
						placeholder="••••••••"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						aria-invalid={Boolean(errors.password)}
					/>
				</FormField>
				<Button type="submit" disabled={loading} className="w-full">
					{loading ? "Signing in…" : "Sign in"}
				</Button>
				<p className="text-center text-sm text-muted-foreground">
					No account?{" "}
					<Link
						href="/sign-up"
						className="font-medium text-foreground underline"
					>
						Sign up
					</Link>
				</p>
			</form>
		</AuthCard>
	);
}
