import { Skeleton } from "@/components/ui/skeleton";

/** Full-shell placeholder shown while the session resolves, so the dashboard
 * fades in instead of flashing a blank screen. */
export function DashboardSkeleton() {
	return (
		<div className="flex min-h-svh w-full bg-muted">
			<aside className="hidden w-64 shrink-0 flex-col gap-4 border-r bg-sidebar p-4 md:flex">
				<Skeleton className="h-9 w-36" />
				<div className="mt-2 flex flex-col gap-2">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
				</div>
				<Skeleton className="mt-auto h-12 w-full" />
			</aside>
			<main className="flex-1 p-6 sm:p-10">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="mt-3 h-4 w-72" />
				<div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-44 w-full rounded-2xl" />
					))}
				</div>
			</main>
		</div>
	);
}
