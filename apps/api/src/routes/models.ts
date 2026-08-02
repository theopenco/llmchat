import { Hono } from "hono";

import { DEFAULT_GATEWAY_BASE } from "@/lib/llm";
import { requireSession } from "@/middleware/session";

import type { AppContext, Env } from "@/env";

// The gateway's /v1/models has no CORS headers, so browsers can't read it
// directly — the dashboard model picker fetches it through this proxy instead.
// Session-gated so the api doesn't become an anonymous relay for a third party.

const CACHE_KEY = "cache:gateway-models";
// Matches the picker's react-query staleTime, so a fresh browser session is at
// most one gateway fetch away from the same 30-minute horizon.
const CACHE_TTL_SECONDS = 60 * 30;

interface CacheEntry {
	body: string;
	// unix seconds; entries past this are stale but still usable on gateway
	// failure (stale-if-error).
	expiresAt: number;
}

async function readCache(env: Env): Promise<CacheEntry | null> {
	try {
		const raw = await env.STATE.get(CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CacheEntry;
		return typeof parsed.body === "string" ? parsed : null;
	} catch {
		// Unavailable store or malformed entry — treat as a cache miss.
		return null;
	}
}

async function writeCache(env: Env, body: string, now: number) {
	try {
		await env.STATE.set(
			CACHE_KEY,
			JSON.stringify({ body, expiresAt: now + CACHE_TTL_SECONDS }),
		);
	} catch (err) {
		// Best-effort: a failed cache write must not fail the response.
		console.error("models: cache write failed", err);
	}
}

const jsonHeaders = { "content-type": "application/json" };

export const models = new Hono<AppContext>().get(
	"/models",
	requireSession,
	async (c) => {
		const now = Math.floor(Date.now() / 1000);
		const cached = await readCache(c.env);
		if (cached && cached.expiresAt > now) {
			return c.body(cached.body, 200, jsonHeaders);
		}

		const base = c.env.vars.LLMGATEWAY_BASE_URL || DEFAULT_GATEWAY_BASE;
		try {
			const res = await fetch(`${base.replace(/\/+$/, "")}/models`);
			if (!res.ok) {
				throw new Error(`gateway responded ${res.status}`);
			}
			const body = await res.text();
			// Never cache or forward something that isn't the expected envelope
			// (e.g. an upstream error page served with a 200).
			const parsed = JSON.parse(body) as { data?: unknown };
			if (!Array.isArray(parsed.data)) {
				throw new Error("gateway response missing data array");
			}
			await writeCache(c.env, body, now);
			return c.body(body, 200, jsonHeaders);
		} catch (err) {
			console.error("models: gateway fetch failed", err);
			// Stale-if-error: an expired cache entry beats no models at all.
			if (cached) {
				return c.body(cached.body, 200, jsonHeaders);
			}
			return c.json({ error: "models_unavailable" }, 502);
		}
	},
);
