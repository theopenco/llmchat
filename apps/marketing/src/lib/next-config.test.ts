import { describe, expect, it, vi } from "vitest";

// Stub the content-collections wrapper so importing next.config.ts doesn't
// boot a content build — we only assert on the plain config object.
vi.mock("@content-collections/next", () => ({
	withContentCollections: (config: unknown) => config,
}));

describe("next.config caching", () => {
	it("pins expireTime at the ISR revalidate interval so HTML is never served stale", async () => {
		// The mobile "first load is unstyled" bug: GitHubStars' fetch
		// (revalidate: 600) makes every page ISR, and Next's default
		// expireTime (1 year) emits `stale-while-revalidate=31535400` on the
		// HTML. Browsers then paint a stale copy whose hashed CSS href 404s
		// after the next deploy. expireTime <= revalidate drops the SWR
		// directive (formatRevalidate returns just `s-maxage=600, `), so the
		// HTML is revalidated before paint.
		const config = (await import("../../next.config")).default;
		expect(config.expireTime).toBeDefined();
		expect(config.expireTime).toBeLessThanOrEqual(600);
	});
});
