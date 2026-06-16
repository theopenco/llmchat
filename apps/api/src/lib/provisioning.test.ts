import { describe, expect, it } from "vitest";

import { member, workspace } from "@llmchat/db";

import { defaultWorkspaceName, provisionWorkspace } from "./provisioning";

import type { db } from "@/lib/db";

/**
 * A minimal Drizzle stand-in that records inserts. `.values()` is awaitable
 * (member insert) and also exposes `.returning()` (workspace insert), matching
 * how Drizzle queries are consumed.
 */
function fakeDb() {
	const inserts: Array<{ table: unknown; values: Record<string, unknown> }> =
		[];
	const database = {
		insert(table: unknown) {
			return {
				values(values: Record<string, unknown>) {
					inserts.push({ table, values });
					const rows = [{ id: "ws-1", ...values }];
					const query = Promise.resolve(rows) as Promise<typeof rows> & {
						returning: () => Promise<typeof rows>;
					};
					query.returning = () => Promise.resolve(rows);
					return query;
				},
			};
		},
	} as unknown as ReturnType<typeof db>;
	return { database, inserts };
}

describe("defaultWorkspaceName", () => {
	it("derives a per-user name, trimming whitespace", () => {
		expect(defaultWorkspaceName("Ada")).toBe("Ada's workspace");
		expect(defaultWorkspaceName("  Ada Lovelace  ")).toBe(
			"Ada Lovelace's workspace",
		);
	});

	it("falls back when there's no usable name", () => {
		expect(defaultWorkspaceName(null)).toBe("My workspace");
		expect(defaultWorkspaceName(undefined)).toBe("My workspace");
		expect(defaultWorkspaceName("   ")).toBe("My workspace");
	});
});

describe("provisionWorkspace", () => {
	it("creates the workspace then the owner membership, and returns the workspace", async () => {
		const { database, inserts } = fakeDb();

		const ws = await provisionWorkspace(database, "user-7", "Acme");

		// Workspace first, owned by the user.
		expect(inserts[0]).toEqual({
			table: workspace,
			values: { name: "Acme", ownerId: "user-7" },
		});
		// Then an owner membership tying the user to the new workspace.
		expect(inserts[1]).toEqual({
			table: member,
			values: { workspaceId: "ws-1", userId: "user-7", role: "owner" },
		});
		expect(inserts).toHaveLength(2);
		// Returns the created workspace (so callers can respond with it).
		expect(ws).toMatchObject({ id: "ws-1", name: "Acme", ownerId: "user-7" });
	});
});
