"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signUp } from "@/lib/auth-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function SignUpPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		const res = await signUp.email({ email, password, name });
		setLoading(false);
		if (res.error) {
			toast.error("Sign up failed", {
				description: res.error.message ?? undefined,
			});
			return;
		}
		router.replace("/inbox");
	}

	return (
		<main className="flex min-h-screen items-center justify-center p-6">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-xl">Create account</CardTitle>
					<CardDescription>
						Get started with llmchat in seconds.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								required
								placeholder="Jane Doe"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								required
								type="email"
								placeholder="you@company.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								required
								type="password"
								placeholder="8+ characters"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</div>
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
				</CardContent>
			</Card>
		</main>
	);
}
