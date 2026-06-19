import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import {
	canCreateProject,
	isModelAllowedForWorkspace,
	isResponseBlocked,
	monthlyResponseCount,
} from "./plan";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENV = { vars: {}, DB: {} } as any;

/** Fake db where count queries resolve to `count` (or throw if `selectThrows`),
 * and the workspace row carries `plan`. Returns the select spy for assertions. */
function mockDb({
	plan,
	count = 0,
	selectThrows = false,
}: {
	plan?: string;
	count?: number;
	selectThrows?: boolean;
}) {
	const select = vi.fn(() => ({
		from: () => ({
			where: async () => {
				if (selectThrows) throw new Error("db down");
				return [{ n: count }];
			},
		}),
	}));
	vi.mocked(db).mockReturnValue({
		query: {
			workspace: { findFirst: async () => (plan ? { plan } : undefined) },
		},
		select,
	} as unknown as ReturnType<typeof db>);
	return select;
}

beforeEach(() => vi.clearAllMocks());

describe("isResponseBlocked", () => {
	it("never blocks an overage plan and skips the count query entirely", async () => {
		const select = mockDb({ count: 999_999 });
		expect(await isResponseBlocked(ENV, "ws", "growth")).toBe(false);
		expect(await isResponseBlocked(ENV, "ws", "scale")).toBe(false);
		expect(select).not.toHaveBeenCalled(); // no wasted query for overage tiers
	});

	it("hard-stops a fixed plan at (and past) its quota", async () => {
		mockDb({ count: 1_000 });
		expect(await isResponseBlocked(ENV, "ws", "starter")).toBe(true);
		mockDb({ count: 999 });
		expect(await isResponseBlocked(ENV, "ws", "starter")).toBe(false);
	});

	it("blocks an unpaid workspace immediately", async () => {
		mockDb({ count: 0 });
		expect(await isResponseBlocked(ENV, "ws", "none")).toBe(true);
	});

	it("FAILS OPEN when the count query throws (a metering bug can't down a live agent)", async () => {
		mockDb({ count: 0, selectThrows: true });
		expect(await isResponseBlocked(ENV, "ws", "starter")).toBe(false);
	});
});

describe("monthlyResponseCount", () => {
	it("returns the counted rows (0 when none)", async () => {
		mockDb({ count: 7 });
		expect(await monthlyResponseCount(ENV, "ws")).toBe(7);
	});
});

describe("canCreateProject", () => {
	it("allows under the cap and blocks at it", async () => {
		mockDb({ plan: "starter", count: 0 });
		expect(await canCreateProject(ENV, "ws")).toBe(true);
		mockDb({ plan: "starter", count: 1 });
		expect(await canCreateProject(ENV, "ws")).toBe(false);
	});

	it("blocks an unpaid workspace (zero project ceiling)", async () => {
		mockDb({ plan: "none", count: 0 });
		expect(await canCreateProject(ENV, "ws")).toBe(false);
	});
});

describe("isModelAllowedForWorkspace", () => {
	it("gates premium models on a basic-only plan but allows them on all-models plans", async () => {
		mockDb({ plan: "starter" });
		expect(await isModelAllowedForWorkspace(ENV, "ws", "claude-opus-4-8")).toBe(
			false,
		);
		mockDb({ plan: "starter" });
		expect(await isModelAllowedForWorkspace(ENV, "ws", "gpt-5.4-mini")).toBe(
			true,
		);
		mockDb({ plan: "scale" });
		expect(await isModelAllowedForWorkspace(ENV, "ws", "claude-opus-4-8")).toBe(
			true,
		);
	});
});
