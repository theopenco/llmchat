import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/plan";

import { widgetConfig } from "./widget-config";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
vi.mock("@/lib/plan", () => ({ resolveAccess: vi.fn() }));

const ENV = {} as unknown as Parameters<typeof widgetConfig.request>[2];

function mockProject(
	project: Record<string, unknown> | undefined,
	branding: "badge" | "none" = "badge",
) {
	vi.mocked(db).mockReturnValue({
		query: { project: { findFirst: async () => project } },
	} as unknown as ReturnType<typeof db>);
	vi.mocked(resolveAccess).mockResolvedValue({
		entitlements: { branding },
	} as unknown as Awaited<ReturnType<typeof resolveAccess>>);
}

beforeEach(() => vi.clearAllMocks());

describe("GET /config/:key — public widget config", () => {
	it("returns the admin-defined suggested questions", async () => {
		mockProject({
			workspaceId: "ws1",
			privacyPolicyUrl: null,
			suggestedQuestions: ["Pricing?", "Refunds?"],
			welcomeMessage: "Welcome to Acme!",
		});
		const res = await widgetConfig.request("/config/pk_x", {}, ENV);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			showBranding: true,
			privacyPolicyUrl: null,
			suggestedQuestions: ["Pricing?", "Refunds?"],
			collectIdentity: false,
			welcomeMessage: "Welcome to Acme!",
		});
	});

	it("returns the configured welcomeMessage; degrades a legacy row to null", async () => {
		mockProject({
			workspaceId: "ws1",
			privacyPolicyUrl: null,
			suggestedQuestions: [],
			// Legacy row predating the column → the endpoint must not 500.
			welcomeMessage: undefined,
		});
		const res = await widgetConfig.request("/config/pk_x", {}, ENV);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ welcomeMessage: null });
	});

	it("reports collectIdentity when the project enables the pre-chat form", async () => {
		mockProject({
			workspaceId: "ws1",
			privacyPolicyUrl: null,
			suggestedQuestions: [],
			collectIdentity: true,
		});
		const res = await widgetConfig.request("/config/pk_x", {}, ENV);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ collectIdentity: true });
	});

	it("defaults collectIdentity to false on a legacy row without the column", async () => {
		mockProject({
			workspaceId: "ws1",
			privacyPolicyUrl: null,
			suggestedQuestions: [],
			collectIdentity: undefined,
		});
		const res = await widgetConfig.request("/config/pk_x", {}, ENV);
		expect(await res.json()).toMatchObject({ collectIdentity: false });
	});

	it("degrades a malformed suggestions column to no chips, never a 500", async () => {
		mockProject({
			workspaceId: "ws1",
			privacyPolicyUrl: null,
			// A legacy/corrupt value that isn't an array of strings.
			suggestedQuestions: { bogus: true },
		});
		const res = await widgetConfig.request("/config/pk_x", {}, ENV);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ suggestedQuestions: [] });
	});

	it("404s an unknown project key", async () => {
		mockProject(undefined);
		const res = await widgetConfig.request("/config/nope", {}, ENV);
		expect(res.status).toBe(404);
	});
});
