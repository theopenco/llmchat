import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export function createDb(d1: D1Database) {
	return drizzle(d1, { schema, casing: "snake_case" });
}

export { schema };
export * from "./schema";
export {
	eq,
	and,
	or,
	desc,
	asc,
	sql,
	like,
	count,
	inArray,
	isNull,
	isNotNull,
	gte,
} from "drizzle-orm";
