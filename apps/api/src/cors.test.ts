import { describe, expect, it } from "vitest";

import app from "./index";

const env = {
	vars: { DASHBOARD_URL: "https://dash.example.com" },
} as unknown as Parameters<typeof app.request>[2];

function preflight(path: string, origin: string) {
	return app.request(
		path,
		{
			method: "OPTIONS",
			headers: {
				Origin: origin,
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "content-type",
			},
		},
		env,
	);
}

describe("/v1/* public widget CORS", () => {
	it("allows arbitrary origins unconditionally (ACAO: *)", async () => {
		for (const origin of [
			"https://some-random-customer.com",
			"http://localhost:5500",
			"https://evil.example",
			"https://llmchat-showcase---preview.meetploy.app",
		]) {
			const res = await preflight("/v1/chat", origin);
			expect(res.headers.get("access-control-allow-origin")).toBe("*");
		}
	});

	it("is non-credentialed (so ACAO: * is valid)", async () => {
		const res = await preflight("/v1/messages", "https://anything.example");
		expect(res.headers.get("access-control-allow-credentials")).toBeNull();
	});
});

describe("/api/* dashboard CORS stays pinned", () => {
	it("allows only DASHBOARD_URL, with credentials", async () => {
		const ok = await preflight("/api/projects", "https://dash.example.com");
		expect(ok.headers.get("access-control-allow-origin")).toBe(
			"https://dash.example.com",
		);
		expect(ok.headers.get("access-control-allow-credentials")).toBe("true");
	});

	it("rejects other origins", async () => {
		const bad = await preflight("/api/projects", "https://evil.com");
		expect(bad.headers.get("access-control-allow-origin")).toBeNull();
	});
});
