import { api } from "@/lib/api";

/** What account deletion will permanently remove (counts across solely-owned
 * workspaces). */
export interface DeletionImpact {
	workspaces: number;
	projects: number;
	conversations: number;
	sources: number;
	members: number;
}

/** Reasons deletion is currently blocked (hints from the GET; DELETE re-verifies
 * the subscription live + fail-closed). */
export interface AccountBlockers {
	activeSubscription: boolean;
	drift: boolean;
	coOwner: boolean;
}

/** The signed-in user's own profile (session-scoped; no id is ever sent). */
export interface Account {
	name: string;
	email: string;
	/** True when the user has a password (a credential account) — drives the
	 * conditional password field in the delete dialog. */
	hasPassword: boolean;
	impact: DeletionImpact;
	blockers: AccountBlockers;
}

/** react-query key for the account profile. */
export const ACCOUNT_KEY = ["account"] as const;

export function fetchAccount() {
	return api<Account>("/api/account");
}

export function updateAccountName(name: string) {
	return api<{ name: string; email: string }>("/api/account", {
		method: "PATCH",
		body: { name },
	});
}

export function deleteAccount(body: {
	confirmEmail: string;
	password?: string;
}) {
	return api<{ ok: true }>("/api/account", { method: "DELETE", body });
}
