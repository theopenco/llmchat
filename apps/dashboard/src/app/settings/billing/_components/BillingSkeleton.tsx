import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export function BillingSkeleton() {
	// Same container as the resolved billing page so there's no width jump when
	// the usage query lands (it doubles as the Suspense fallback).
	return (
		<PageContainer className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-7 w-32" />
				<Skeleton className="h-4 w-64" />
			</div>
			<Skeleton className="h-48 w-full rounded-xl" />
		</PageContainer>
	);
}
