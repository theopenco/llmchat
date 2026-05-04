import { createDb } from "@llmchat/db";

import type { Env } from "@/env";

export function db(env: Env) {
	return createDb(env.DB);
}
