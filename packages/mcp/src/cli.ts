#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ClankerClient } from "./client.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

// stdout is the MCP protocol channel — all human output goes to stderr.
try {
	const cfg = loadConfig();
	const server = createServer(new ClankerClient(cfg));
	await server.connect(new StdioServerTransport());
	console.error(`clanker-support MCP server ready (${cfg.apiUrl})`);
} catch (err) {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
}
