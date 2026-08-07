import type { Plan } from "@llmchat/shared";

/** GET /admin/me — the frontend access gate. */
export interface Me {
	email: string;
	isAdmin: boolean;
}

/** usage_event.kind breakdown (#169): visitor chat responses, operator-side
 * AI drafts (Suggest with AI), voice-call mints. Counts label the classes
 * apart; cost figures stay all-kind — but every writer inserts costUsd: 0
 * today, so those sums are structurally $0 (#206), never presented as spend. */
export interface KindCounts {
	chat: number;
	suggestion: number;
	voice: number;
}

/** GET /admin/overview — everything the overview page renders in one call. */
export interface Overview {
	users: { total: number; new24h: number; new7d: number; new30d: number };
	subscriptions: {
		byPlan: Record<Plan, number>;
		activePaid: number;
		estMrrUsd: number;
		estArrUsd: number;
	};
	usage: {
		/** All-kind totals — every kind counted, including drafts + voice. */
		responsesTotal: number;
		responses30d: number;
		tokensTotal: number;
		costUsdTotal: number;
		costUsd30d: number;
		byKindTotal: KindCounts;
		byKind30d: KindCounts;
	};
	content: {
		workspaces: number;
		projects: number;
		conversations: number;
		messages: number;
	};
	signupsSeries: { date: string; count: number }[];
	/** `responses`/`cost` are all-kind day totals; the kind fields split them. */
	usageSeries: ({
		date: string;
		responses: number;
		cost: number;
	} & KindCounts)[];
	recentUsers: {
		id: string;
		name: string;
		email: string;
		createdAt: string;
	}[];
}

/** GET /admin/workspaces — one row per workspace. */
export interface WorkspaceRow {
	id: string;
	name: string;
	plan: Plan;
	ownerEmail: string | null;
	hasSubscription: boolean;
	members: number;
	projects: number;
	/** All-kind 30d row count (chat30d + suggestion30d + voice30d + unknown). */
	responses30d: number;
	chat30d: number;
	suggestion30d: number;
	voice30d: number;
	/** All-kind — structurally $0 until costUsd is populated (#206). */
	costUsd30d: number;
	createdAt: string;
}

/** GET /admin/users — one row per user. */
export interface UserRow {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	role: "user" | "admin";
	createdAt: string;
}
