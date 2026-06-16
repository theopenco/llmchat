import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Full-screen placeholder while we resolve session + onboarding state. */
export function OnboardingSkeleton() {
	return (
		<main className="flex min-h-screen items-center justify-center p-6">
			<Card className="w-full max-w-md">
				<CardHeader className="gap-2">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-4 w-full" />
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
				</CardContent>
			</Card>
		</main>
	);
}
