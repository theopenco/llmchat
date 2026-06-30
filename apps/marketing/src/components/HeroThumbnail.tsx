"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { LaunchHero } from "./LaunchHero";

// The preview hero is laid out at this fixed width, then transform-scaled down to
// whatever width the featured card gives us — so the thumbnail is a true, pixel-
// faithful miniature of the real hero (single source of truth), not a redraw.
const DESIGN_WIDTH = 1120;

/**
 * Featured-card thumbnail: the launch hero (variant 1A, preview mode) scaled to
 * fit its container. Decorative — the real heading/links live in the article, so
 * the scaled copy is aria-hidden.
 */
export function HeroThumbnail() {
	const frameRef = useRef<HTMLDivElement>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState<number | null>(null);
	const [height, setHeight] = useState(0);

	useLayoutEffect(() => {
		const frame = frameRef.current;
		const stage = stageRef.current;
		if (!frame || !stage) return;
		const measure = () => {
			const s = frame.clientWidth / DESIGN_WIDTH;
			setScale(s);
			// Frame height follows the scaled stage so the card hugs the hero.
			setHeight(stage.offsetHeight * s);
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(frame);
		return () => ro.disconnect();
	}, []);

	return (
		<div
			ref={frameRef}
			aria-hidden
			className="relative w-full overflow-hidden rounded-2xl border border-rule"
			style={{ height: height || undefined }}
		>
			<div
				ref={stageRef}
				className="origin-top-left"
				style={{
					width: DESIGN_WIDTH,
					transform: scale ? `scale(${scale})` : undefined,
					// Hidden until measured so there's no unscaled flash.
					visibility: scale ? undefined : "hidden",
				}}
			>
				<LaunchHero preview />
			</div>
		</div>
	);
}
