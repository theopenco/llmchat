"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signUp } from "@/lib/auth-client";

export default function SignUpPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		const res = await signUp.email({ email, password, name });
		setLoading(false);
		if (res.error) {
			setError(res.error.message ?? "Sign up failed");
			return;
		}
		router.replace("/inbox");
	}

	return (
		<main className="flex min-h-screen items-center justify-center p-6">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow"
			>
				<h1 className="text-xl font-semibold">Create account</h1>
				<input
					required
					placeholder="name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					className="w-full rounded-md border border-gray-300 px-3 py-2"
				/>
				<input
					required
					type="email"
					placeholder="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="w-full rounded-md border border-gray-300 px-3 py-2"
				/>
				<input
					required
					type="password"
					placeholder="password (8+ chars)"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					className="w-full rounded-md border border-gray-300 px-3 py-2"
				/>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<button
					type="submit"
					disabled={loading}
					className="w-full rounded-md bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
				>
					{loading ? "Creating…" : "Create account"}
				</button>
				<p className="text-center text-sm text-gray-600">
					Already have an account?{" "}
					<Link href="/sign-in" className="text-gray-900 underline">
						Sign in
					</Link>
				</p>
			</form>
		</main>
	);
}
