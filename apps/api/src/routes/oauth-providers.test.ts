import { describe, expect, it } from "vitest";

import { oauthProviders } from "./oauth-providers";

/** The route only reads c.env.vars; pass a bindings object as the third arg. */
async function get(vars: Record<string, string | undefined>) {
	const res = await oauthProviders.request("/oauth-providers", {}, {
		vars,
	} as unknown as Record<string, unknown>);
	return { status: res.status, body: await res.json() };
}

describe("GET /oauth-providers", () => {
	it("reports both providers off when nothing is configured (buttons stay disabled)", async () => {
		const { status, body } = await get({});
		expect(status).toBe(200);
		expect(body).toEqual({ google: false, github: false });
	});

	it("reports a provider on only when BOTH its id and secret are set", async () => {
		expect((await get({ GOOGLE_CLIENT_ID: "id" })).body).toEqual({
			google: false,
			github: false,
		});
		expect(
			(
				await get({
					GOOGLE_CLIENT_ID: "id",
					GOOGLE_CLIENT_SECRET: "secret",
				})
			).body,
		).toEqual({ google: true, github: false });
	});

	it("reports each fully-configured provider independently", async () => {
		const { body } = await get({
			GITHUB_CLIENT_ID: "id",
			GITHUB_CLIENT_SECRET: "secret",
		});
		expect(body).toEqual({ google: false, github: true });
	});
});
