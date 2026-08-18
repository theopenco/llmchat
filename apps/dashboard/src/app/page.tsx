"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { isTransientSessionError, useSession } from "@/lib/auth-client";

export default function Home() {
	const router = useRouter();
	const { data, isPending, error } = useSession();
	useEffect(() => {
		if (isPending) {
			return;
		}
		// On a transient get-session failure (429/5xx blip) hold instead of
		// bouncing a validly-cookied user to /sign-in; the next refetch decides.
		if (!data?.user && isTransientSessionError(error)) {
			return;
		}
		router.replace(data?.user ? "/inbox" : "/sign-in");
	}, [data, isPending, error, router]);
	// The entry route is a pure redirect decision — while the session resolves,
	// paint the dashboard skeleton (the destination for the common signed-in
	// case) instead of a blank page.
	return <DashboardSkeleton />;
}
