// Unit contract for insertMessage (#146) — THE single message writer. The
// atomic-allocation behavior itself is proven end-to-end in
// internal-notes.e2e.test.ts (real sqlite); this file pins the mechanics the
// e2e can't reach: the retry-once-on-unique-violation path (the 0024 index
// tripwire, mock-forced) and the exact shape of what reaches the driver.

import { SQL } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));

import { db } from "@/lib/db";

import { insertMessage } from "./messages";

import type { Env } from "@/env";

const ENV = {} as unknown as Env;

// The REAL prod shape: drizzle 0.45 wraps every driver error in
// DrizzleQueryError whose own message is "Failed query: …" — the
// "UNIQUE constraint failed" text lives ONLY on the cause. A message-only
// isUniqueViolation never matches this; these tests pin the cause-chain walk.
const UNIQUE_ERR = new Error(
	"Failed query: insert into message ...\nparams: c1,note",
	{
		cause: new Error(
			"UNIQUE constraint failed: message.conversation_id, message.sequence",
		),
	},
);

/** Mocked drizzle client: the first `failInserts` insert executions reject
 * with `error`; later ones return a stored row. Captures everything. */
function mockDb({
	failInserts = 0,
	error = UNIQUE_ERR,
}: { failInserts?: number; error?: Error } = {}) {
	let attempts = 0;
	const inserted: Record<string, unknown>[] = [];
	const values = vi.fn((row: Record<string, unknown>) => {
		inserted.push(row);
		return {
			returning: async () => {
				attempts += 1;
				if (attempts <= failInserts) {
					throw error;
				}
				return [{ id: "m1", role: row.role, sequence: 7 }];
			},
		};
	});
	const bumpReturning = vi.fn(async () => [{ messageCount: 9 }]);
	const setPayloads: Record<string, unknown>[] = [];
	const set = vi.fn((payload: Record<string, unknown>) => {
		setPayloads.push(payload);
		return { where: () => ({ returning: bumpReturning }) };
	});
	vi.mocked(db).mockReturnValue({
		insert: () => ({ values }),
		update: () => ({ set }),
	} as unknown as ReturnType<typeof db>);
	return { values, set, setPayloads, bumpReturning, inserted };
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	vi.clearAllMocks();
	errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	errorSpy.mockRestore();
});

const INPUT = {
	conversationId: "c1",
	role: "note" as const,
	content: "flagging",
	authorUserId: "u2",
};

describe("insertMessage", () => {
	it("happy path: one insert, SQL subquery sequence, SQL increment bump, post-bump count returned", async () => {
		const { values, setPayloads, inserted } = mockDb();
		const out = await insertMessage(ENV, INPUT);
		expect(values).toHaveBeenCalledTimes(1);
		expect(out.row).toMatchObject({ id: "m1", role: "note", sequence: 7 });
		expect(out.messageCount).toBe(9);
		// The sequence handed to the driver is the scalar subquery — never a
		// number precomputed from messageCount.
		expect(inserted[0].sequence).toBeInstanceOf(SQL);
		// The count bump is commutative SQL (+1), never an absolute value.
		expect(setPayloads[0].messageCount).toBeInstanceOf(SQL);
		expect(setPayloads[0].updatedAt).toBeInstanceOf(Date);
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("retries EXACTLY once on a unique violation, logging the first failure", async () => {
		const { values, bumpReturning } = mockDb({ failInserts: 1 });
		const out = await insertMessage(ENV, INPUT);
		expect(values).toHaveBeenCalledTimes(2);
		expect(out.row).toMatchObject({ id: "m1" });
		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(String(errorSpy.mock.calls[0][0])).toContain(
			"unique sequence collision",
		);
		// The count bumps once — for the row that actually landed.
		expect(bumpReturning).toHaveBeenCalledTimes(1);
	});

	it("a second unique violation propagates — one retry only, never a loop", async () => {
		const { values, bumpReturning } = mockDb({ failInserts: 2 });
		await expect(insertMessage(ENV, INPUT)).rejects.toThrow(/failed query/i);
		expect(values).toHaveBeenCalledTimes(2);
		expect(bumpReturning).not.toHaveBeenCalled();
	});

	it("also recognizes a BARE driver error (the e2e/proxy shape, no wrapper)", async () => {
		const { values } = mockDb({
			failInserts: 1,
			error: new Error(
				"UNIQUE constraint failed: message.conversation_id, message.sequence",
			),
		});
		const out = await insertMessage(ENV, INPUT);
		expect(values).toHaveBeenCalledTimes(2);
		expect(out.row).toMatchObject({ id: "m1" });
	});

	it("non-unique errors are NOT retried — they propagate immediately, unbumped", async () => {
		const { values, bumpReturning } = mockDb({
			failInserts: 1,
			error: new Error("database is locked"),
		});
		await expect(insertMessage(ENV, INPUT)).rejects.toThrow(
			"database is locked",
		);
		expect(values).toHaveBeenCalledTimes(1);
		expect(errorSpy).not.toHaveBeenCalled();
		expect(bumpReturning).not.toHaveBeenCalled();
	});
});
