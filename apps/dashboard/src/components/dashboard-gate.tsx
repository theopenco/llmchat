import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { DashboardShell } from "@/components/dashboard-shell";
import { apiServer } from "@/lib/api-server";
import { getQueryClient } from "@/lib/get-query-client";
import { getServerSession } from "@/lib/session";
import { type WorkspacesResponse, WORKSPACES_KEY } from "@/lib/workspace-utils";

/**
 * Server entry for every dashboard route. Resolves the session and prefetches
 * the workspace list on the server, then hands both to the client shell so the
 * page hydrates without the session -> workspaces -> data request waterfall.
 *
 * A failed prefetch simply isn't dehydrated (react-query only serializes
 * successful queries), so the client refetches as before — server prefetch is a
 * pure enhancement that never breaks the page.
 */
export async function DashboardGate({
	children,
}: {
	children: React.ReactNode;
}) {
	const queryClient = getQueryClient();
	const [session] = await Promise.all([
		getServerSession(),
		queryClient.prefetchQuery({
			queryKey: WORKSPACES_KEY,
			queryFn: () => apiServer<WorkspacesResponse>("/api/workspaces"),
		}),
	]);

	return (
		<DashboardShell initialEmail={session?.user.email}>
			<HydrationBoundary state={dehydrate(queryClient)}>
				{children}
			</HydrationBoundary>
		</DashboardShell>
	);
}
