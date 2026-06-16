// The web-search model set is GENERATED from @llmgateway/models — see
// web-search-models.generated.ts and `pnpm gen:web-search-models`. This module
// wraps that snapshot with the helpers the app uses; it is the single source of
// truth for "web-search only" across the dashboard picker, API chat guard, and
// data migration.
import { WEB_SEARCH_MODELS } from "./web-search-models.generated";

// Loud failure, never a blank picker: if the generated snapshot is ever empty
// (a botched regen), fail at import rather than silently offer no models.
if (WEB_SEARCH_MODELS.length === 0) {
	throw new Error(
		"WEB_SEARCH_MODELS is empty — run `pnpm gen:web-search-models` to regenerate from @llmgateway/models",
	);
}

export { WEB_SEARCH_MODELS };

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
