import { Skeleton } from "@/components/ui/skeleton";

export function BillingSkeleton() {
	return (
		<div className="mx-auto w-full max-w-2xl space-y-6 p-6">
			<div className="space-y-2">
				<Skeleton className="h-7 w-32" />
				<Skeleton className="h-4 w-64" />
			</div>
			<Skeleton className="h-48 w-full rounded-xl" />
		</div>
	);
}
