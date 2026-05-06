import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/schema.ts",
	out: "../../apps/api/migrations",
	dialect: "sqlite",
	casing: "snake_case",
});
