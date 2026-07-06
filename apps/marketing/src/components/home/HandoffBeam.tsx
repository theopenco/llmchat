"use client";

import { useRef } from "react";
import { MotionConfig } from "motion/react";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { cn } from "@/lib/utils";

/**
 * The thesis as a picture: visitor → agent (⇄ docs) → team inbox. Beams are
 * decorative (aria-hidden); the copy around the diagram carries the meaning.
 * MotionConfig reducedMotion="user" freezes the beams for reduced-motion users.
 */
function Node({
	label,
	sub,
	className,
	nodeRef,
	emphasis = false,
}: {
	label: string;
	sub: string;
	className?: string;
	nodeRef: React.RefObject<HTMLDivElement | null>;
	emphasis?: boolean;
}) {
	return (
		<div
			ref={nodeRef}
			className={cn(
				"z-10 flex w-36 flex-col items-center gap-0.5 rounded-2xl border bg-paper-card/90 px-4 py-3 text-center shadow-lift sm:w-44",
				emphasis ? "border-accent/50" : "border-rule",
				className,
			)}
		>
			<span className="font-display text-sm font-semibold text-ink">{label}</span>
			<span className="text-[0.7rem] leading-snug text-muted">{sub}</span>
		</div>
	);
}

export function HandoffBeam() {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const visitorRef = useRef<HTMLDivElement | null>(null);
	const agentRef = useRef<HTMLDivElement | null>(null);
	const docsRef = useRef<HTMLDivElement | null>(null);
	const inboxRef = useRef<HTMLDivElement | null>(null);

	return (
		<MotionConfig reducedMotion="user">
			<div
				ref={containerRef}
				className="relative mx-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-3xl border border-rule bg-paper-deep/50 px-5 py-14 sm:px-10 sm:py-16"
			>
				<Node nodeRef={visitorRef} label="Your visitor" sub="asks on your site" />
				<div className="flex flex-col items-center gap-8">
					<Node
						nodeRef={agentRef}
						label="Clanker agent"
						sub="answers instantly"
						emphasis
					/>
					<Node nodeRef={docsRef} label="Your docs" sub="the only source it uses" />
				</div>
				<Node nodeRef={inboxRef} label="Team inbox" sub="humans take over" />

				<AnimatedBeam
					containerRef={containerRef}
					fromRef={visitorRef}
					toRef={agentRef}
					curvature={-40}
					pathColor="rgba(124,162,255,0.25)"
					gradientStartColor="#2E6BFF"
					gradientStopColor="#7CA2FF"
					duration={5}
				/>
				<AnimatedBeam
					containerRef={containerRef}
					fromRef={docsRef}
					toRef={agentRef}
					curvature={30}
					reverse
					pathColor="rgba(124,162,255,0.25)"
					gradientStartColor="#7CA2FF"
					gradientStopColor="#2E6BFF"
					duration={6}
					delay={1}
				/>
				<AnimatedBeam
					containerRef={containerRef}
					fromRef={agentRef}
					toRef={inboxRef}
					curvature={-40}
					pathColor="rgba(124,162,255,0.25)"
					gradientStartColor="#2E6BFF"
					gradientStopColor="#7CA2FF"
					duration={5}
					delay={2.5}
				/>
			</div>
		</MotionConfig>
	);
}
