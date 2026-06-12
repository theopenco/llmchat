import { Skeleton } from "@/components/ui/skeleton";

/** Two-column placeholder for the inbox while the workspace/conversations load. */
export function InboxSkeleton() {
	return (
		<div className="grid h-[calc(100vh-3.5rem)] grid-cols-[20rem_1fr]">
			<aside className="flex flex-col gap-3 border-r bg-background p-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={i} className="flex flex-col gap-1.5">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-3 w-40" />
					</div>
				))}
			</aside>
			<section className="flex items-center justify-center">
				<Skeleton className="h-4 w-48" />
			</section>
		</div>
	);
}
