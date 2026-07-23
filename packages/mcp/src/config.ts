/** Connector configuration, read from the environment — the only config
 * channel every MCP client (Claude Code, Codex, generic) supports. */
export type ClankerConfig = {
	/** API origin. Defaults to the hosted API; point at your own deployment
	 * (e.g. http://localhost:8787) when self-hosting. */
	apiUrl: string;
	email: string;
	password: string;
	/** Optional. When absent and the account belongs to exactly one workspace,
	 * that workspace is used; with several, the one with the most projects. */
	workspaceId?: string;
};

const DEFAULT_API_URL = "https://api.clankersupport.com";

export function loadConfig(
	env: Record<string, string | undefined> = process.env,
): ClankerConfig {
	const email = env.CLANKER_EMAIL;
	const password = env.CLANKER_PASSWORD;
	const missing = [
		...(email ? [] : ["CLANKER_EMAIL"]),
		...(password ? [] : ["CLANKER_PASSWORD"]),
	];
	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variable(s): ${missing.join(", ")}. ` +
				"Set them to the email and password of a Clanker Support operator account " +
				"(create a dedicated account for automation if you prefer).",
		);
	}
	return {
		apiUrl: (env.CLANKER_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, ""),
		email: email!,
		password: password!,
		workspaceId: env.CLANKER_WORKSPACE_ID || undefined,
	};
}
