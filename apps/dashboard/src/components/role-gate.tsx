"use client";

import type { ReactNode } from "react";

import { useWorkspace } from "@/lib/workspace";

/**
 * Render `children` only when the active role may manage the workspace
 * (owner/admin); otherwise render `fallback` (nothing by default).
 *
 * Composition over flags: instead of threading a `canManage` boolean into every
 * button, wrap the management-only UI. The server enforces the same rule via
 * requireRole("admin") — this is purely so agents aren't shown actions that
 * would only 403. Keep destructive/irreversible affordances inside a gate.
 */
export function RoleGate({
	children,
	fallback = null,
}: {
	children: ReactNode;
	fallback?: ReactNode;
}) {
	const { canManage } = useWorkspace();
	return <>{canManage ? children : fallback}</>;
}
