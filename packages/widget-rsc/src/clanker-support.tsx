import { Suspense } from "react";

import { ClankerSupportWidget } from "./default/widget";
import { fetchWidgetConfig } from "./protocol/api";
import { DEFAULT_API_URL } from "./protocol/constants";

import type { ClankerSupportWidgetProps } from "./default/widget";

export interface ClankerSupportProps extends Omit<
	ClankerSupportWidgetProps,
	"initialConfig"
> {}

/**
 * The one-liner: drop `<ClankerSupport apiKey="…" />` into your Next.js root
 * layout and the support widget shows up on every page.
 *
 * This is a Server Component. It prefetches the project's widget config
 * (branding, privacy URL) on the server — cached and revalidated every 5
 * minutes — so the client does one less round-trip and never flashes
 * incorrect branding. The fetch is wrapped in Suspense with a `null`
 * fallback, so it NEVER blocks your page: the page streams immediately and
 * the widget pops in when the config resolves; if the API is unreachable the
 * widget still renders with fail-safe defaults.
 *
 * Rendering it from a Client Component? Use `ClankerSupportWidget` from
 * `@clankersupport/widget-rsc/headless` instead (same widget, client-side
 * config fetch).
 */
export function ClankerSupport(props: ClankerSupportProps) {
	if (!props.apiKey) {
		console.warn(
			"[@clankersupport/widget-rsc] missing `apiKey` — widget not rendered. " +
				"Find your project's key in the dashboard under Project → Embed.",
		);
		return null;
	}
	return (
		<Suspense fallback={null}>
			<ClankerSupportLoader {...props} />
		</Suspense>
	);
}

async function ClankerSupportLoader({
	apiUrl = DEFAULT_API_URL,
	...props
}: ClankerSupportProps) {
	const config = await fetchWidgetConfig(apiUrl, props.apiKey, {
		// Next.js Data Cache hint; a no-op on other RSC runtimes. Returns null
		// on any failure, so a down API can never break the host page.
		next: { revalidate: 300 },
	} as RequestInit);
	return (
		<ClankerSupportWidget {...props} apiUrl={apiUrl} initialConfig={config} />
	);
}
