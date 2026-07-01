"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect } from "react";

import { ApiError } from "@/lib/api";
import { signOut } from "@/lib/auth-client";
import { useMe } from "@/lib/hooks";

/**
 * Client-side access gate for every console page. Server-side, the API's
 * `requireGlobalAdmin` is the real authority (a non-admin gets a 403 from every
 * data route no matter what) — this just picks the right UI:
 *   - no session (401)      → bounce to /login
 *   - signed in, not admin  → "access restricted" screen
 *   - admin                 → render the console
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
	const { data, isLoading, error } = useMe();

	const unauthenticated = error instanceof ApiError && error.status === 401;

	useEffect(() => {
		if (unauthenticated) {
			const next = encodeURIComponent(
				window.location.pathname + window.location.search,
			);
			window.location.assign(`/login?next=${next}`);
		}
	}, [unauthenticated]);

	if (isLoading || unauthenticated) {
		return (
			<FullScreen>{<Loader2 className="size-5 animate-spin" />}</FullScreen>
		);
	}

	if (error || !data) {
		return (
			<FullScreen>
				<div className="flex flex-col items-center gap-3 text-center">
					<ShieldAlert className="size-7 text-neg" />
					<p className="text-sm text-muted">
						Couldn&apos;t reach the admin API. Try again shortly.
					</p>
				</div>
			</FullScreen>
		);
	}

	if (!data.isAdmin) {
		return (
			<FullScreen>
				<div className="card max-w-sm p-8 text-center">
					<ShieldAlert className="mx-auto mb-4 size-8 text-warn" />
					<h1 className="text-lg font-semibold">Access restricted</h1>
					<p className="mt-2 text-sm text-muted">
						{data.email} isn&apos;t a platform admin. Ask an existing admin to
						grant your account access.
					</p>
					<button
						type="button"
						onClick={() =>
							signOut().then(() => window.location.assign("/login"))
						}
						className="mt-6 inline-flex items-center rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:bg-raise hover:text-text"
					>
						Sign out
					</button>
				</div>
			</FullScreen>
		);
	}

	return <>{children}</>;
}

function FullScreen({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-dvh items-center justify-center text-muted">
			{children}
		</div>
	);
}
