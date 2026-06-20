"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

/**
 * Footer for the paginated conversation list: an intersection sentinel that
 * auto-loads the next page as it scrolls into view, with an explicit "Load more"
 * button as the accessible fallback (and the affordance in environments without
 * IntersectionObserver, e.g. tests). Rendered only when another page exists.
 */
export function LoadMore({
	onLoadMore,
	loading,
}: {
	onLoadMore: () => void;
	loading: boolean;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el || typeof IntersectionObserver === "undefined") return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting) && !loading) onLoadMore();
			},
			{ rootMargin: "200px" },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [onLoadMore, loading]);

	return (
		<div ref={ref} className="px-3 py-3">
			<Button
				variant="outline"
				size="sm"
				className="w-full"
				onClick={onLoadMore}
				disabled={loading}
			>
				{loading ? "Loading…" : "Load more"}
			</Button>
		</div>
	);
}
