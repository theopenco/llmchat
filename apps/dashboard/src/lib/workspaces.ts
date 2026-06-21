import { ApiError, api, describeApiError } from "@/lib/api";

/** Create a new workspace owned by the signed-in user. The server provisions it
 * with plan=none (the user picks a plan on entry). */
export function createWorkspace(name: string) {
	return api<{ workspace: { id: string; name: string } }>("/api/workspaces", {
		method: "POST",
		body: { name },
	});
}

/** Permanently delete a workspace + all of its data. Owner-of-this-workspace
 * only; the server re-checks the subscription gate and the last-workspace guard
 * live (fail-closed), so a stale client can't force a delete. */
export function deleteWorkspace(id: string) {
	return api<{ ok: true }>(`/api/workspaces/${id}`, { method: "DELETE" });
}

/** Map a DELETE /workspaces/:id failure to a clear, actionable sentence. The
 * server is authoritative: it re-runs the gates, so these mirror its codes. */
export function deleteWorkspaceErrorMessage(e: unknown): string {
	if (e instanceof ApiError) {
		switch (e.code) {
			case "forbidden":
				return "Only an owner of this workspace can delete it.";
			case "last_workspace":
				return "This is your only workspace. Create another, or delete your account instead.";
			case "active_subscription":
				return "Cancel this workspace's subscription in Billing before deleting it.";
			case "billing_unverified":
				return "We couldn't verify this workspace's billing status — please try again.";
			case "billing_drift":
				return "We couldn't confirm this workspace's billing status. Contact support.";
		}
	}
	return describeApiError(e, "Couldn't delete the workspace");
}
