export interface EnvVars {
	LLMGATEWAY_API_KEY: string;
	LLMGATEWAY_BASE_URL: string;

	RESEND_API_KEY: string;
	RESEND_FROM_EMAIL: string;
	INBOUND_EMAIL_DOMAIN: string;

	STRIPE_SECRET_KEY: string;
	STRIPE_WEBHOOK_SECRET: string;

	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	DASHBOARD_URL: string;

	WIDGET_ALLOWED_ORIGINS: string;

	// Optional — analytics is a no-op when unset.
	POSTHOG_API_KEY?: string;
	POSTHOG_HOST?: string;
}

export interface Env {
	DB: D1Database;
	CACHE: KVNamespace;
	vars: EnvVars;
}

export interface Variables {
	userId: string;
	workspaceId: string;
}

export type AppContext = {
	Bindings: Env;
	Variables: Variables;
};
