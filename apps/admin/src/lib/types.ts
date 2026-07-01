import type { Plan } from "@llmchat/shared";

/** GET /admin/me — the frontend access gate. */
export interface Me {
	email: string;
	isAdmin: boolean;
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
		responsesTotal: number;
		responses30d: number;
		tokensTotal: number;
		costUsdTotal: number;
		costUsd30d: number;
	};
	content: {
		workspaces: number;
		projects: number;
		conversations: number;
		messages: number;
	};
	signupsSeries: { date: string; count: number }[];
	usageSeries: { date: string; responses: number; cost: number }[];
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
	responses30d: number;
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
