"use client";

import { useEffect, useState } from "react";

import { CANONICAL_SHOWCASE_URL, resolveForCurrentHost } from "@/lib/site-urls";

/**
 * "Live demo" link to the showcase app. Resolves after mount so preview hosts
 * link to their preview showcase sibling; starts at the canonical URL to keep
 * server/client markup in sync.
 */
export function LiveDemoLink({ className = "" }: { className?: string }) {
	const [href, setHref] = useState(CANONICAL_SHOWCASE_URL);
	useEffect(() => {
		setHref(resolveForCurrentHost(CANONICAL_SHOWCASE_URL));
	}, []);

	return (
		<a href={href} className={className}>
			<span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_2px_rgba(99,102,241,0.6)]" />
			Live demo
		</a>
	);
}
