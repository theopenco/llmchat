"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * In-view deferral for the two motion-powered islands. Their chunks (motion +
 * component code) load ~400px before the section scrolls in, instead of during
 * initial hydration — the hero and LCP stay untouched. Wrappers reserve height
 * so late mounting can't shift layout.
 */
const HandoffBeamInner = dynamic(
	() => import("./HandoffBeam").then((m) => m.HandoffBeam),
	{ ssr: false, loading: () => null },
);
const InstallTerminalInner = dynamic(
	() => import("./InstallTerminal").then((m) => m.InstallTerminal),
	{ ssr: false, loading: () => null },
);

function InView({
	children,
	className,
	minHeight,
}: {
	children: ReactNode;
	className?: string;
	minHeight: number;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [show, setShow] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (typeof IntersectionObserver === "undefined") {
			setShow(true);
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					setShow(true);
					io.disconnect();
				}
			},
			{ rootMargin: "400px 0px" },
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);

	return (
		<div ref={ref} className={className} style={{ minHeight }}>
			{show ? children : null}
		</div>
	);
}

export function DeferredHandoffBeam() {
	return (
		<InView minHeight={280}>
			<HandoffBeamInner />
		</InView>
	);
}

export function DeferredInstallTerminal() {
	return (
		<InView minHeight={300}>
			<InstallTerminalInner />
		</InView>
	);
}
