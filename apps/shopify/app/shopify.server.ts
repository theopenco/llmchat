import {
	ApiVersion,
	AppDistribution,
	shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { DrizzleSessionStorageSQLite } from "@shopify/shopify-app-session-storage-drizzle";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import { drizzle, type AnyD1Database } from "drizzle-orm/d1";
import { sessionTable } from "./db/session.server";

/**
 * workerd port (Ploy spike): shopifyApp() is no longer a module-scope
 * singleton. On workerd, env arrives per request as a binding object — so
 * every consumer calls getShopify(context) and we memoize per env object
 * (one instance per isolate; the runtime passes the same env object to every
 * request). Under `shopify app dev` (react-router dev on Node, no worker
 * entry) there is no context.cloudflare, so we fall back to process.env +
 * an in-memory session store — sessions don't survive a dev-server restart,
 * but embedded token exchange silently re-mints them on the next request.
 *
 * The template's `@shopify/shopify-app-react-router/adapters/node` import is
 * gone deliberately: the package's server entry already loads the web-api
 * runtime adapter itself (Web Crypto HMAC, fetch); the node adapter only set
 * a label and read process.env.APP_BRIDGE_URL at module scope — which throws
 * on workerd.
 */

export interface ShopifyEnv {
	SHOPIFY_API_KEY?: string;
	SHOPIFY_API_SECRET?: string;
	SHOPIFY_APP_URL?: string;
	SCOPES?: string;
	SHOP_CUSTOM_DOMAIN?: string;
	CLANKER_API_ORIGIN?: string;
	/**
	 * D1-compatible binding (Ploy `db:`) holding Shopify sessions — this app's
	 * OWN database (`shopify_sessions`), never the api's `llmchat_db`.
	 */
	SESSION_DB?: unknown;
}

/**
 * Ploy's prod runtime delivers PLAIN env vars nested under `env.vars`
 * (resource bindings like SESSION_DB stay flat on `env`, and the values are
 * also mirrored into process.env before user code evaluates) — same contract
 * the api relies on with `c.env.vars.DASHBOARD_URL`. Local `wrangler dev` /
 * `ploy dev` use wrangler.jsonc verbatim, where `vars` ARE flat on `env`.
 * normalizeEnv folds both shapes into one flat ShopifyEnv.
 */
type PloyWorkerEnv = ShopifyEnv & {
	vars?: Record<string, string>;
} & Record<string, unknown>;

type CloudflareContext = {
	cloudflare?: { env?: PloyWorkerEnv };
};

function normalizeEnv(raw: PloyWorkerEnv): ShopifyEnv {
	return raw.vars ? ({ ...raw, ...raw.vars } as ShopifyEnv) : raw;
}

function buildShopify(env: ShopifyEnv) {
	return shopifyApp({
		apiKey: env.SHOPIFY_API_KEY,
		apiSecretKey: env.SHOPIFY_API_SECRET || "",
		apiVersion: ApiVersion.October25,
		scopes: env.SCOPES?.split(","),
		appUrl: env.SHOPIFY_APP_URL || "",
		authPathPrefix: "/auth",
		// D1 via the official drizzle adapter: sessions are durable
		// source-of-truth (offline tokens), which belongs on a `db:` binding —
		// the `state:` KV binding is ephemeral-only by repo convention, and its
		// deployed dialect isn't full KV (apps/api/src/lib/kv.ts).
		sessionStorage: env.SESSION_DB
			? new DrizzleSessionStorageSQLite(
					drizzle(env.SESSION_DB as AnyD1Database),
					sessionTable,
				)
			: new MemorySessionStorage(),
		distribution: AppDistribution.AppStore,
		future: {
			expiringOfflineAccessTokens: true,
		},
		...(env.SHOP_CUSTOM_DOMAIN
			? { customShopDomains: [env.SHOP_CUSTOM_DOMAIN] }
			: {}),
	});
}

export type Shopify = ReturnType<typeof buildShopify>;

const perEnv = new WeakMap<object, Shopify>();
let nodeFallback: Shopify | undefined;

/** Resolve the flat env for a request — worker binding on Ploy (vars unnested), process.env under `shopify app dev`. */
export function getShopifyEnv(context?: unknown): ShopifyEnv {
	const env = (context as CloudflareContext | undefined)?.cloudflare?.env;
	if (env) return normalizeEnv(env);
	return process.env as ShopifyEnv;
}

export function getShopify(context?: unknown): Shopify {
	const env = (context as CloudflareContext | undefined)?.cloudflare?.env;
	if (env) {
		// Memoize on the RAW env object (the runtime passes the same one to
		// every request); build from the normalized flat view.
		let instance = perEnv.get(env);
		if (!instance) {
			instance = buildShopify(normalizeEnv(env));
			perEnv.set(env, instance);
		}
		return instance;
	}
	if (!nodeFallback) {
		nodeFallback = buildShopify(process.env as ShopifyEnv);
	}
	return nodeFallback;
}

export const apiVersion = ApiVersion.October25;
