import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { DrizzleSessionStorageSQLite } from "@shopify/shopify-app-session-storage-drizzle";
// Session is re-exported by the framework package (@shopify/shopify-api is a
// transitive dep pnpm's strict layout won't let us import directly).
import { Session } from "@shopify/shopify-app-react-router/server";
import { sessionTable } from "./session.server";

/**
 * Contract test with teeth: the table is created by executing the REAL
 * hand-authored migration (migrations/0001_create_session.sql), then the REAL
 * adapter runs against it — so drift between the drizzle schema, the SQL
 * migration, and the adapter's column expectations fails here instead of on
 * the first production install.
 */
function makeStorage() {
	const sqlite = new Database(":memory:");
	sqlite.exec(
		readFileSync(
			join(__dirname, "../../migrations/0001_create_session.sql"),
			"utf-8",
		),
	);
	return new DrizzleSessionStorageSQLite(
		drizzle(sqlite) as never,
		sessionTable,
	);
}

function offlineSession(id: string, shop: string): Session {
	return new Session({
		id,
		shop,
		state: "state",
		isOnline: false,
		accessToken: "token",
		scope: "",
	});
}

describe("DrizzleSessionStorageSQLite over the hand-authored migration", () => {
	it("stores, loads, finds by shop, and deletes a session", async () => {
		const storage = makeStorage();
		const s = offlineSession("offline_x.myshopify.com", "x.myshopify.com");

		expect(await storage.storeSession(s)).toBe(true);

		const loaded = await storage.loadSession(s.id);
		expect(loaded?.shop).toBe("x.myshopify.com");
		expect(loaded?.accessToken).toBe("token");
		expect(loaded?.isOnline).toBe(false);

		const found = await storage.findSessionsByShop("x.myshopify.com");
		expect(found.map((f) => f.id)).toEqual([s.id]);
		expect(await storage.findSessionsByShop("other.myshopify.com")).toEqual([]);

		await storage.deleteSessions([s.id]);
		expect(await storage.loadSession(s.id)).toBeUndefined();
		expect(await storage.findSessionsByShop("x.myshopify.com")).toEqual([]);
	});

	it("upserts on re-store (token refresh overwrites, never duplicates)", async () => {
		const storage = makeStorage();
		const first = offlineSession("offline_y.myshopify.com", "y.myshopify.com");
		await storage.storeSession(first);

		const refreshed = new Session({
			id: first.id,
			shop: first.shop,
			state: "state-2",
			isOnline: false,
			accessToken: "token-2",
		});
		await storage.storeSession(refreshed);

		const found = await storage.findSessionsByShop("y.myshopify.com");
		expect(found).toHaveLength(1);
		expect(found[0]?.accessToken).toBe("token-2");
	});

	it("round-trips expires (stored as ISO text, restored as a Date)", async () => {
		const storage = makeStorage();
		const expires = new Date("2027-01-02T03:04:05.000Z");
		const s = new Session({
			id: "offline_z.myshopify.com",
			shop: "z.myshopify.com",
			state: "state",
			isOnline: false,
			accessToken: "token",
			expires,
		});
		await storage.storeSession(s);
		const loaded = await storage.loadSession(s.id);
		expect(loaded?.expires?.getTime()).toBe(expires.getTime());
	});
});
