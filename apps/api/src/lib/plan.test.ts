import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import {
	canCreateProject,
	isModelAllowedForWorkspace,
	isResponseBlocked,
	monthlyResponseCount,
	resolveAccess,
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
	ownerEmail = "user@customer.com",
	stripeCustomerId = null as string | null,
}: {
	plan?: string;
	count?: number;
	selectThrows?: boolean;
	ownerEmail?: string;
	stripeCustomerId?: string | null;
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
			workspace: {
				findFirst: async () =>
					plan ? { plan, ownerId: "owner1", stripeCustomerId } : undefined,
			},
			user: { findFirst: async () => ({ email: ownerEmail }) },
		},
		select,
	} as unknown as ReturnType<typeof db>);
	return select;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const envWith = (emails?: string): any => ({
	vars: emails ? { INTERNAL_ACCOUNT_EMAILS: emails } : {},
	DB: {},
});

beforeEach(() => vi.clearAllMocks());

describe("isResponseBlocked", () => {
	it("never blocks an overage plan and skips the count query entirely", async () => {
		const select = mockDb({ count: 999_999 });
		expect(await isResponseBlocked(ENV, "ws", "growth")).toBe(false);
		expect(await isResponseBlocked(ENV, "ws", "scale")).toBe(false);
		expect(select).not.toHaveBeenCalled(); // no wasted query for overage tiers
	});

	it("hard-stops a fixed plan at (and past) its quota", async () => {
		mockDb({ count: 2_000 });
		expect(await isResponseBlocked(ENV, "ws", "starter")).toBe(true);
		mockDb({ count: 1_999 });
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
		mockDb({ plan: "starter", count: 1 }); // starter cap = 2
		expect(await canCreateProject(ENV, "ws")).toBe(true);
		mockDb({ plan: "starter", count: 2 });
		expect(await canCreateProject(ENV, "ws")).toBe(false);
	});

	it("blocks an unpaid workspace from building at all (hard gate, zero ceiling)", async () => {
		mockDb({ plan: "none", count: 0 });
		expect(await canCreateProject(ENV, "ws")).toBe(false);
	});
});

describe("resolveAccess — owner exemption", () => {
	it("exempts a workspace whose OWNER email is on the internal allowlist", async () => {
		mockDb({ plan: "none", ownerEmail: "founder@clanker.com" });
		const access = await resolveAccess(envWith("founder@clanker.com"), "ws");
		expect(access.exempt).toBe(true);
		expect(access.plan).toBe("internal");
		expect(access.entitlements.modelAccess).toBe("all");
	});

	it("does NOT exempt a normal workspace (owner not listed)", async () => {
		mockDb({ plan: "growth", ownerEmail: "user@customer.com" });
		const access = await resolveAccess(envWith("founder@clanker.com"), "ws");
		expect(access.exempt).toBe(false);
		expect(access.plan).toBe("growth");
	});

	it("skips the owner-email lookup entirely when no allowlist is configured", async () => {
		// A spy on the user query would never fire — exemption is impossible
		// without an allowlist, so a normal user can't be exempt by default.
		mockDb({ plan: "starter", ownerEmail: "founder@clanker.com" });
		const access = await resolveAccess(envWith(undefined), "ws");
		expect(access.exempt).toBe(false);
		expect(access.plan).toBe("starter");
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
