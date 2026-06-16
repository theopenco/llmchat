/**
 * Canonical set of LLM Gateway models that support web search, sourced from the
 * gateway's own catalog filter (https://llmgateway.io/models/web-search). The
 * public /v1/models API exposes no usable web-search flag, so this pinned list
 * is the SINGLE SOURCE OF TRUTH for "web-search only" across the app:
 *   - the dashboard model picker filters to it,
 *   - the API chat path guards against stale saved models,
 *   - the data migration heals projects off non-web-search models.
 *
 * SQL can't import this, so apps/api/migrations/0008_heal_non_web_search_models.sql
 * duplicates these ids with a comment pointing back here — keep them in sync.
 */
export const WEB_SEARCH_MODELS = [
	"gpt-5.5-pro",
	"gpt-5.5",
	"gpt-5.4-pro",
	"gpt-5.4",
	"gpt-5.4-mini",
	"gpt-5.4-nano",
	"gpt-5.3-codex",
	"gpt-5.2-codex",
	"claude-opus-4-8",
	"claude-opus-4-7",
	"claude-sonnet-4-6",
	"gemini-pro-latest",
	"gemini-3.5-flash",
	"gemini-3.1-pro-preview",
	"gemini-3.1-flash-lite",
	"qwen3.7-max",
	"qwen3.6-plus",
	"qwen3.6-35b-a3b",
	"qwen35-397b-a17b",
	"glm-5.1",
] as const;

export const WEB_SEARCH_MODEL_IDS: ReadonlySet<string> = new Set(
	WEB_SEARCH_MODELS,
);

/** Default model for new projects — always a member of the set above. */
export const DEFAULT_MODEL = "gpt-5.4-mini";

/** True when `id` is a web-search-capable gateway model. */
export function isWebSearchModel(id: string): boolean {
	return WEB_SEARCH_MODEL_IDS.has(id);
}

/**
 * The model to actually run for a given saved value: the saved model when it's
 * still a valid web-search model, otherwise the default. Guards the live chat
 * path against projects stuck on a model that's no longer offered.
 */
export function effectiveModel(model: string | null | undefined): string {
	return model && isWebSearchModel(model) ? model : DEFAULT_MODEL;
}
