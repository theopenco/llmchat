"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

import { useSession } from "@/lib/auth-client";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
	process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

function PageviewTracker() {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	useEffect(() => {
		if (!posthog.__loaded) return;
		let url = window.origin + pathname;
		const qs = searchParams.toString();
		if (qs) url += `?${qs}`;
		posthog.capture("$pageview", { $current_url: url });
	}, [pathname, searchParams]);

	return null;
}

function IdentifyUser() {
	const { data } = useSession();
	const identified = useRef<string | null>(null);

	useEffect(() => {
		if (!posthog.__loaded) return;
		const user = data?.user;
		if (user && identified.current !== user.id) {
			posthog.identify(user.id, { email: user.email, name: user.name });
			identified.current = user.id;
		} else if (!user && identified.current) {
			posthog.reset();
			identified.current = null;
		}
	}, [data]);

	return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		if (!POSTHOG_KEY || posthog.__loaded) return;
		posthog.init(POSTHOG_KEY, {
			api_host: POSTHOG_HOST,
			capture_pageview: false, // handled manually for the App Router
			capture_pageleave: true,
			autocapture: true,
		});
	}, []);

	return (
		<>
			<Suspense fallback={null}>
				<PageviewTracker />
			</Suspense>
			<IdentifyUser />
			{children}
		</>
	);
}
