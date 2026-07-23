import type { ClankerConfig } from "./config.js";

/** An API error with the HTTP status and the server's error payload, surfaced
 * verbatim to the MCP client so the model can react (e.g. 402 = plan limit). */
export class ClankerApiError extends Error {
	constructor(
		readonly status: number,
		readonly body: string,
	) {
		super(`Clanker Support API error ${status}: ${body}`);
		this.name = "ClankerApiError";
	}
}

type Query = Record<string, string | number | undefined>;

/**
 * Minimal authenticated client for the Clanker Support dashboard API.
 *
 * Auth is the same email+password flow the dashboard uses (Better Auth):
 * sign in once, capture the session cookie, replay it on every call, and
 * re-authenticate transparently when the session expires (one retry per
 * request). Workspace scoping is the dashboard's `x-workspace-id` header.
 */
export class ClankerClient {
	private cookie: string | null = null;
	private workspaceId: string | null;

	constructor(
		private readonly cfg: ClankerConfig,
		private readonly fetchImpl: typeof fetch = fetch,
	) {
		this.workspaceId = cfg.workspaceId ?? null;
	}

	private async signIn(): Promise<void> {
		const res = await this.fetchImpl(
			`${this.cfg.apiUrl}/api/auth/sign-in/email`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					// Node's fetch always sends Sec-Fetch-* headers, which makes
					// Better Auth demand a trusted Origin. The API trusts its own
					// origin (same-origin is CSRF-safe), so present exactly that.
					origin: new URL(this.cfg.apiUrl).origin,
				},
				body: JSON.stringify({
					email: this.cfg.email,
					password: this.cfg.password,
				}),
			},
		);
		if (!res.ok) {
			throw new ClankerApiError(
				res.status,
				"sign-in failed — check CLANKER_EMAIL / CLANKER_PASSWORD" +
					(this.cfg.apiUrl.includes("clankersupport.com")
						? ""
						: ` against ${this.cfg.apiUrl}`),
			);
		}
		// Keep only the cookie pairs (drop attributes) so they replay verbatim.
		const pairs = res.headers
			.getSetCookie()
			.map((c) => c.split(";")[0])
			.filter(Boolean);
		if (pairs.length === 0) {
			throw new ClankerApiError(res.status, "sign-in returned no session");
		}
		this.cookie = pairs.join("; ");
	}

	/** The active workspace id — configured, or resolved once from the account's
	 * memberships (single workspace, else the one with the most projects). */
	async resolveWorkspaceId(): Promise<string> {
		if (this.workspaceId) return this.workspaceId;
		const data = (await this.request("/api/workspaces", {
			workspace: false,
		})) as {
			workspaces: { workspace: { id: string }; projectCount: number }[];
		};
		const rows = data.workspaces;
		if (rows.length === 0) {
			throw new Error(
				"This account belongs to no workspace. Sign in to the dashboard once to provision one.",
			);
		}
		const best = [...rows].sort((a, b) => b.projectCount - a.projectCount)[0];
		this.workspaceId = best.workspace.id;
		return this.workspaceId;
	}

	async request(
		path: string,
		opts: {
			method?: string;
			query?: Query;
			body?: unknown;
			/** Attach the x-workspace-id header (default true). */
			workspace?: boolean;
			retried?: boolean;
		} = {},
	): Promise<unknown> {
		if (!this.cookie) await this.signIn();

		const url = new URL(`${this.cfg.apiUrl}${path}`);
		for (const [k, v] of Object.entries(opts.query ?? {})) {
			if (v !== undefined) url.searchParams.set(k, String(v));
		}
		const headers: Record<string, string> = { cookie: this.cookie! };
		if (opts.workspace !== false) {
			headers["x-workspace-id"] = await this.resolveWorkspaceId();
		}
		if (opts.body !== undefined) {
			headers["content-type"] = "application/json";
		}

		const res = await this.fetchImpl(url, {
			method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
			headers,
			body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
		});

		if (res.status === 401 && !opts.retried) {
			// Session expired — sign in again and retry once.
			this.cookie = null;
			return this.request(path, { ...opts, retried: true });
		}
		if (!res.ok) {
			throw new ClankerApiError(res.status, await res.text());
		}
		return res.json();
	}

	// ── Domain methods (paths mirror apps/api/src/routes/*) ─────────────

	listWorkspaces() {
		return this.request("/api/workspaces", { workspace: false });
	}

	listProjects() {
		return this.request("/api/projects");
	}

	listConversations(
		projectId: string,
		q: { status?: string; search?: string; limit?: number },
	) {
		return this.request(`/api/projects/${projectId}/conversations`, {
			query: { ...q },
		});
	}

	conversationStats(projectId: string) {
		return this.request(`/api/projects/${projectId}/conversations/stats`);
	}

	getConversation(
		projectId: string,
		conversationId: string,
		q: { limit?: number; before?: number },
	) {
		return this.request(
			`/api/projects/${projectId}/conversations/${conversationId}`,
			{ query: { ...q } },
		);
	}

	reply(projectId: string, conversationId: string, content: string) {
		return this.request(
			`/api/projects/${projectId}/conversations/${conversationId}/reply`,
			{ body: { content } },
		);
	}

	addNote(projectId: string, conversationId: string, content: string) {
		return this.request(
			`/api/projects/${projectId}/conversations/${conversationId}/notes`,
			{ body: { content } },
		);
	}

	listSources(projectId: string) {
		return this.request(`/api/projects/${projectId}/sources`);
	}

	addUrlSource(projectId: string, body: { url: string; title?: string }) {
		return this.request(`/api/projects/${projectId}/sources`, { body });
	}

	addTextSource(projectId: string, body: { content: string; title?: string }) {
		return this.request(`/api/projects/${projectId}/sources/text`, { body });
	}

	addQaSource(projectId: string, body: { question: string; answer: string }) {
		return this.request(`/api/projects/${projectId}/sources/qa`, { body });
	}

	search(q: string) {
		return this.request("/api/search", { query: { q } });
	}
}
