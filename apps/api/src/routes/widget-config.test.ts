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
	voiceCalls = false,
	/** Uploaded agent-photo row, or undefined = none (URL-field fallback). */
	avatarRow?: { contentType: string; data: string; updatedAt: Date },
) {
	vi.mocked(db).mockReturnValue({
		query: {
			project: { findFirst: async () => project },
			projectAvatar: { findFirst: async () => avatarRow },
		},
	} as unknown as ReturnType<typeof db>);
	vi.mocked(resolveAccess).mockResolvedValue({
		entitlements: { branding, voiceCalls },
	} as unknown as Awaited<ReturnType<typeof resolveAccess>>);
}

// 8 PNG magic bytes — a "real enough" stored avatar for the asset route.
const PNG_B64 = "iVBORw0KGgo=";

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
			voiceEnabled: false,
			privacyPolicyUrl: null,
			suggestedQuestions: ["Pricing?", "Refunds?"],
			collectIdentity: false,
			welcomeMessage: "Welcome to Acme!",
			avatarUrl: null,
		});
	});

	it("returns the configured agent avatar URL", async () => {
		mockProject({
			workspaceId: "ws1",
			privacyPolicyUrl: null,
			suggestedQuestions: [],
			avatarUrl: "https://acme.example/team/sam.jpg",
		});
		const res = await widgetConfig.request("/config/pk_x", {}, ENV);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			avatarUrl: "https://acme.example/team/sam.jpg",
		});
	});

	it("an UPLOADED photo wins over the avatarUrl field — served from this api origin with a cache-busting version", async () => {
		mockProject(
			{
				id: "p1",
				workspaceId: "ws1",
				privacyPolicyUrl: null,
				suggestedQuestions: [],
				avatarUrl: "https://acme.example/team/sam.jpg",
			},
			"badge",
			false,
			{
				contentType: "image/png",
				data: PNG_B64,
				updatedAt: new Date(1_755_000_000_000),
			},
		);
		const res = await widgetConfig.request("/config/pk_x", {}, ENV);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			avatarUrl: "http://localhost/v1/avatar/pk_x?v=1755000000",
		});
	});

	it("degrades a missing project_avatar table (preview DB) to the URL field, never a 500", async () => {
		mockProject({
			id: "p1",
			workspaceId: "ws1",
			privacyPolicyUrl: null,
			suggestedQuestions: [],
			avatarUrl: "https://acme.example/team/sam.jpg",
		});
		// Preview DBs skip migrations: the avatar lookup throws "no such table".
		vi.mocked(db).mockReturnValue({
			query: {
				project: {
					findFirst: async () => ({
						id: "p1",
						workspaceId: "ws1",
						privacyPolicyUrl: null,
						suggestedQuestions: [],
						avatarUrl: "https://acme.example/team/sam.jpg",
					}),
				},
				projectAvatar: {
					findFirst: async () => {
						throw new Error("no such table: project_avatar");
					},
				},
			},
		} as unknown as ReturnType<typeof db>);
		const res = await widgetConfig.request("/config/pk_x", {}, ENV);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			avatarUrl: "https://acme.example/team/sam.jpg",
		});
	});

	it("degrades a legacy/blank avatar column to null, never a 500", async () => {
		mockProject({
			workspaceId: "ws1",
			privacyPolicyUrl: null,
			suggestedQuestions: [],
			// Legacy row predating the column, and an emptied value.
			avatarUrl: undefined,
		});
		expect(
			await (await widgetConfig.request("/config/pk_x", {}, ENV)).json(),
		).toMatchObject({ avatarUrl: null });
		mockProject({
			workspaceId: "ws1",
			privacyPolicyUrl: null,
			suggestedQuestions: [],
			avatarUrl: "",
		});
		expect(
			await (await widgetConfig.request("/config/pk_x", {}, ENV)).json(),
		).toMatchObject({ avatarUrl: null });
	});

	it("enables voice only when the resolved entitlements carry voiceCalls", async () => {
		mockProject(
			{ workspaceId: "ws1", privacyPolicyUrl: null, suggestedQuestions: [] },
			"none",
			true,
		);
		const res = await widgetConfig.request("/config/pk_x", {}, ENV);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ voiceEnabled: true });
	});

	it("degrades a missing voiceCalls entitlement to disabled, never a 500", async () => {
		mockProject({
			workspaceId: "ws1",
			privacyPolicyUrl: null,
			suggestedQuestions: [],
		});
		// Entitlements shape predating the field — voiceCalls absent entirely.
		vi.mocked(resolveAccess).mockResolvedValue({
			entitlements: { branding: "badge" },
		} as unknown as Awaited<ReturnType<typeof resolveAccess>>);
		const res = await widgetConfig.request("/config/pk_x", {}, ENV);
		expect(await res.json()).toMatchObject({ voiceEnabled: false });
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

describe("GET /avatar/:key — public uploaded-avatar asset", () => {
	it("serves the stored bytes with the verified content-type and immutable caching", async () => {
		mockProject({ id: "p1", workspaceId: "ws1" }, "badge", false, {
			contentType: "image/png",
			data: PNG_B64,
			updatedAt: new Date(1_755_000_000_000),
		});
		const res = await widgetConfig.request("/avatar/pk_x", {}, ENV);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/png");
		expect(res.headers.get("cache-control")).toContain("immutable");
		expect((await res.arrayBuffer()).byteLength).toBe(8);
	});

	it("404s an unknown key and a project without an upload", async () => {
		mockProject(undefined);
		expect((await widgetConfig.request("/avatar/nope", {}, ENV)).status).toBe(
			404,
		);
		mockProject({ id: "p1", workspaceId: "ws1" });
		expect((await widgetConfig.request("/avatar/pk_x", {}, ENV)).status).toBe(
			404,
		);
	});

	it("404s corrupt stored data instead of serving garbage", async () => {
		mockProject({ id: "p1", workspaceId: "ws1" }, "badge", false, {
			contentType: "image/png",
			data: "not base64!!",
			updatedAt: new Date(),
		});
		expect((await widgetConfig.request("/avatar/pk_x", {}, ENV)).status).toBe(
			404,
		);
	});
});
