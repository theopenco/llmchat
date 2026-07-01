"use client";

import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";

import { cx } from "@/lib/cx";
import { signIn } from "@/lib/auth-client";

/** Only same-origin relative paths are honored as a post-login redirect. */
function safeNext(): string {
	if (typeof window === "undefined") return "/";
	const n = new URLSearchParams(window.location.search).get("next");
	return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (!email || password.length < 8) {
			setError("Enter your email and password (8+ characters).");
			return;
		}
		setLoading(true);
		const res = await signIn.email({ email, password });
		if (res.error) {
			setLoading(false);
			setError(res.error.message ?? "Sign in failed.");
			return;
		}
		// Hard navigation: the session cookie is set on the API origin, so a soft
		// nav would land with a stale client session and bounce back. A full load
		// re-initializes the session with the cookie present. The AdminGate then
		// enforces admin-only access.
		window.location.assign(safeNext());
	}

	return (
		<div className="flex min-h-dvh items-center justify-center px-4">
			<div className="w-full max-w-sm">
				<div className="mb-8 flex flex-col items-center gap-3 text-center">
					<span className="grid size-11 place-items-center rounded-lg bg-accent/15 text-accent-soft">
						<span className="num text-base font-bold">CS</span>
					</span>
					<div>
						<div className="font-mono text-xs font-semibold uppercase tracking-label text-text">
							Clanker · Admin
						</div>
						<p className="mt-1 text-sm text-muted">
							Sign in to the operations console
						</p>
					</div>
				</div>

				<form
					onSubmit={onSubmit}
					noValidate
					className="card flex flex-col gap-4 p-6"
				>
					<Field label="Email">
						<Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
						<input
							type="email"
							autoComplete="username"
							placeholder="you@clankersupport.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={inputClass}
						/>
					</Field>
					<Field label="Password">
						<Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
						<input
							type="password"
							autoComplete="current-password"
							placeholder="••••••••"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={inputClass}
						/>
					</Field>

					{error ? <p className="text-sm text-neg">{error}</p> : null}

					<button
						type="submit"
						disabled={loading}
						className="mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft disabled:opacity-60"
					>
						{loading ? (
							<>
								<Loader2 className="size-4 animate-spin" /> Signing in…
							</>
						) : (
							<>
								Sign in <ArrowRight className="size-4" />
							</>
						)}
					</button>
				</form>

				<p className="mt-4 text-center text-xs text-faint">
					Platform admins only. Access is granted by a Clanker Support operator.
				</p>
			</div>
		</div>
	);
}

const inputClass =
	"w-full rounded-md border border-line bg-bg/60 px-9 py-2.5 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-accent/60 focus:ring-2 focus:ring-accent/25";

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className={cx("label")}>{label}</span>
			<span className="relative block">{children}</span>
		</label>
	);
}
