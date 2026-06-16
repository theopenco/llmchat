import { Skeleton } from "@/components/ui/skeleton";

export function ConversationListSkeleton() {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{Array.from({ length: 5 }, (_, i) => (
				<div key={i} className="space-y-2 border-b p-3">
					<Skeleton className="h-4 w-2/3" />
					<Skeleton className="h-3 w-1/2" />
				</div>
			))}
		</div>
	);
}

export function ThreadSkeleton() {
	return (
		<div className="flex flex-1 flex-col gap-3 p-6">
			<Skeleton className="h-12 w-2/3 self-start rounded-2xl" />
			<Skeleton className="h-12 w-1/2 self-end rounded-2xl" />
			<Skeleton className="h-12 w-3/5 self-start rounded-2xl" />
		</div>
	);
}
