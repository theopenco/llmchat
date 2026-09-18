import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import {
	hasConsumedTrial,
	isTrialEligible,
	markTrialConsumed,
	markTrialConsumedForWorkspace,
} from "./trial";

import type { Env } from "@/env";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));

const ENV = { vars: {}, DB: {} } as unknown as Env;

interface Opts {
	rows?: Array<{ startedAt: number | null }>;
	readThrows?: boolean;
	runThrows?: boolean;
	workspace?: { ownerId: string } | undefined;
}

function mockDb(opts: Opts = {}) {
	const state = { ran: 0, lastSql: null as unknown };
	const fake = {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: async () => {
						if (opts.readThrows) {
							throw new Error("no such column: trial_started_at");
						}
						return opts.rows ?? [{ startedAt: null }];
					},
				}),
			}),
		}),
		run: async (q: unknown) => {
			if (opts.runThrows) throw new Error("no such column: trial_started_at");
			state.ran++;
			state.lastSql = q;
			return { success: true };
		},
		query: {
			workspace: { findFirst: async () => opts.workspace },
		},
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
	return state;
}

beforeEach(() => vi.clearAllMocks());

describe("hasConsumedTrial", () => {
	it("is false when the user has never trialed", async () => {
		mockDb({ rows: [{ startedAt: null }] });
		expect(await hasConsumedTrial(ENV, "u1")).toBe(false);
	});

	it("is true once a timestamp is stamped", async () => {
		mockDb({ rows: [{ startedAt: 1_700_000_000 }] });
		expect(await hasConsumedTrial(ENV, "u1")).toBe(true);
	});

	it("is false for a user with no row at all", async () => {
		mockDb({ rows: [] });
		expect(await hasConsumedTrial(ENV, "ghost")).toBe(false);
	});

	it("degrades open when the 0030 column is missing (preview DB)", async () => {
		mockDb({ readThrows: true });
		expect(await hasConsumedTrial(ENV, "u1")).toBe(false);
	});
});

describe("isTrialEligible", () => {
	it("grants the trial to a first-time owner on an unpaid workspace", async () => {
		mockDb({ rows: [{ startedAt: null }] });
		expect(await isTrialEligible(ENV, "u1", "none")).toBe(true);
	});

	it("withholds it once the owner has burned their trial", async () => {
		mockDb({ rows: [{ startedAt: 1_700_000_000 }] });
		expect(await isTrialEligible(ENV, "u1", "none")).toBe(false);
	});

	it("withholds it on a tier SWITCH without even reading the column", async () => {
		const state = mockDb({ rows: [{ startedAt: null }] });
		expect(await isTrialEligible(ENV, "u1", "starter")).toBe(false);
		expect(state.ran).toBe(0);
	});
});

describe("markTrialConsumed", () => {
	it("issues the guarded UPDATE", async () => {
		const state = mockDb();
		await markTrialConsumed(ENV, "u1");
		expect(state.ran).toBe(1);
	});

	it("never throws when the column is missing — a Stripe webhook must not retry", async () => {
		mockDb({ runThrows: true });
		await expect(markTrialConsumed(ENV, "u1")).resolves.toBeUndefined();
	});
});

describe("markTrialConsumedForWorkspace", () => {
	it("burns the trial of the workspace's owner", async () => {
		const state = mockDb({ workspace: { ownerId: "u1" } });
		await markTrialConsumedForWorkspace(ENV, "ws_1");
		expect(state.ran).toBe(1);
	});

	it("no-ops for an unknown workspace", async () => {
		const state = mockDb({ workspace: undefined });
		await markTrialConsumedForWorkspace(ENV, "ws_missing");
		expect(state.ran).toBe(0);
	});
});
