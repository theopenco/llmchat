// Type surface for the dev-seed runner (seed.mjs stays plain JS so `node`
// can run it directly; this lets the vitest suite import its guards typed).

type Env = Record<string, string | undefined>;

/** Throws if `env.NODE_ENV === "production"`. */
export function assertDevOnly(env?: Env): void;

/** Local Ploy DB path; honors `env.PLOY_DB_PATH`, else the default under .ploy. */
export function resolveDbPath(env?: Env): string;
