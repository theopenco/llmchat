// Worker bindings + env vars come from the Ploy-generated global `PloyEnv`
// (see env.d.ts, produced by `ploy types`). Only the Hono request-scoped
// variables live here, since they're app state rather than Ploy bindings.
export type Env = PloyEnv;

export type Role = "owner" | "admin" | "agent";

export interface Variables {
	userId: string;
	workspaceId: string;
	/** The caller's role in the active workspace, cached by requireWorkspace so
	 * requireRole can assert without a second membership query. */
	role: Role;
}

export type AppContext = {
	Bindings: PloyEnv;
	Variables: Variables;
};
