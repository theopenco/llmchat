import Link from "next/link";
import { type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Vendored from Magic UI (magicui.design/r/bento-grid.json), restyled to the
 * marketing token system (paper/ink/rule/accent) and de-shadcn'd: next/link
 * instead of Button asChild, inline arrow instead of @radix-ui/react-icons.
 */
interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
	children: ReactNode;
	className?: string;
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
	name: string;
	className: string;
	background: ReactNode;
	eyebrow: string;
	description: string;
	href: string;
	cta: string;
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
	return (
		<div
			className={cn(
				"grid w-full auto-rows-[20rem] grid-cols-3 gap-4",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
};

const BentoCard = ({
	name,
	className,
	background,
	eyebrow,
	description,
	href,
	cta,
	...props
}: BentoCardProps) => (
	<div
		key={name}
		className={cn(
			"group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-2xl",
			"border border-rule bg-paper-card/60 transition-colors hover:border-accent/40",
			className,
		)}
		{...props}
	>
		<div>{background}</div>
		<div className="p-6">
			<div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 transition-all duration-300 lg:group-hover:-translate-y-9">
				<span className="font-mono text-xs font-medium text-faint transition-colors group-hover:text-accent-soft">
					{eyebrow}
				</span>
				<h3 className="font-display mt-2 text-xl font-semibold tracking-tight-display text-ink">
					{name}
				</h3>
				<p className="max-w-lg text-sm leading-relaxed text-muted">
					{description}
				</p>
			</div>

			<div className="pointer-events-none flex w-full translate-y-0 transform-gpu flex-row items-center pt-3 transition-all duration-300 lg:hidden">
				<Link
					href={href}
					className="pointer-events-auto inline-flex items-center gap-1 text-sm font-medium text-accent-soft transition-colors hover:text-accent"
				>
					{cta}
					<span aria-hidden>→</span>
				</Link>
			</div>
		</div>

		<div className="pointer-events-none absolute bottom-0 hidden w-full translate-y-9 transform-gpu flex-row items-center p-6 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:flex">
			<Link
				href={href}
				className="pointer-events-auto inline-flex items-center gap-1 text-sm font-medium text-accent-soft transition-colors hover:text-accent"
			>
				{cta}
				<span aria-hidden>→</span>
			</Link>
		</div>

		<div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-paper-raise/20" />
	</div>
);

export { BentoCard, BentoGrid };
