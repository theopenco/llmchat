import { api } from "@/lib/api";

/** The signed-in user's own profile (session-scoped; no id is ever sent). */
export interface Account {
	name: string;
	email: string;
}

/** react-query key for the account profile. */
export const ACCOUNT_KEY = ["account"] as const;

export function fetchAccount() {
	return api<Account>("/api/account");
}

export function updateAccountName(name: string) {
	return api<Account>("/api/account", { method: "PATCH", body: { name } });
}
