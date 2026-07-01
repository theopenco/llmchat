"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

import type { Me, Overview, UserRow, WorkspaceRow } from "./types";

/** Identity + admin flag. `retry: false` so a 401/403 surfaces immediately to
 * the access gate instead of retrying. */
export function useMe() {
	return useQuery({
		queryKey: ["admin", "me"],
		queryFn: () => api<Me>("/admin/me"),
		retry: false,
		staleTime: 30_000,
	});
}

/** Overview metrics. Polls every 30s so the console stays live-ish. */
export function useOverview() {
	return useQuery({
		queryKey: ["admin", "overview"],
		queryFn: () => api<Overview>("/admin/overview"),
		refetchInterval: 30_000,
	});
}

export function useWorkspaces() {
	return useQuery({
		queryKey: ["admin", "workspaces"],
		queryFn: () =>
			api<{ workspaces: WorkspaceRow[] }>("/admin/workspaces?limit=200"),
	});
}

export function useUsers() {
	return useQuery({
		queryKey: ["admin", "users"],
		queryFn: () => api<{ users: UserRow[] }>("/admin/users?limit=200"),
	});
}
