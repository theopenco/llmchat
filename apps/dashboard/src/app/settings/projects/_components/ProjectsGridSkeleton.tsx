import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholder for the projects grid; matches the card footprint so the
 * layout doesn't shift when real data arrives. */
export function ProjectsGridSkeleton({ count = 6 }: { count?: number }) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: count }).map((_, i) => (
				<Skeleton key={i} className="h-44 w-full rounded-2xl" />
			))}
		</div>
	);
}
