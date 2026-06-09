import { cn } from "@/lib/utils";

/** A white, rounded, numbered configuration card matching the dashboard mockup. */
export function SectionCard({
	id,
	step,
	title,
	description,
	headerRight,
	children,
	className,
}: {
	id?: string;
	step: number;
	title: string;
	description: string;
	headerRight?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section
			id={id}
			className={cn(
				"scroll-mt-24 rounded-2xl border border-border bg-card p-6 shadow-sm",
				className,
			)}
		>
			<div className="flex items-start gap-4">
				<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
					{step}
				</span>
				<div className="flex flex-1 flex-col gap-4">
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<h2 className="text-base font-semibold text-foreground">
								{title}
							</h2>
							<p className="text-sm text-muted-foreground">{description}</p>
						</div>
						{headerRight}
					</div>
					{children}
				</div>
			</div>
		</section>
	);
}
