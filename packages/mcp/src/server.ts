import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ClankerClient } from "./client.js";

const VERSION = "0.1.0";

/** Wrap a handler: JSON results as text content, errors as isError results so
 * the model sees the API's message (401/402/404 …) instead of a dead call. */
function handle<A extends unknown[]>(
	fn: (...args: A) => Promise<unknown>,
): (...args: A) => Promise<{
	content: { type: "text"; text: string }[];
	isError?: boolean;
}> {
	return async (...args: A) => {
		try {
			const data = await fn(...args);
			return {
				content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
			};
		} catch (err) {
			return {
				content: [{ type: "text", text: String(err) }],
				isError: true,
			};
		}
	};
}

/** Build the MCP server over an authenticated client. Tool names and argument
 * shapes mirror the dashboard API (apps/api) — the server adds no state of its
 * own. */
export function createServer(client: ClankerClient): McpServer {
	const server = new McpServer({ name: "clanker-support", version: VERSION });

	server.registerTool(
		"list_workspaces",
		{
			description:
				"List the workspaces this account belongs to, with role and project count. " +
				"Useful to find a workspace id for CLANKER_WORKSPACE_ID when the account has several.",
			inputSchema: {},
		},
		handle(() => client.listWorkspaces()),
	);

	server.registerTool(
		"list_projects",
		{
			description:
				"List the support projects (embedded widgets) in the active workspace — id, name, public key, model, and settings. Most other tools need a projectId from here.",
			inputSchema: {},
		},
		handle(() => client.listProjects()),
	);

	server.registerTool(
		"list_conversations",
		{
			description:
				"List support conversations in a project, newest first. Filter by status " +
				"(open = active, escalated = customer asked for a human, resolved = archived, all) " +
				"or full-text search. Returns per-conversation metadata, tags, and a snippet of the first message.",
			inputSchema: {
				projectId: z.string().describe("Project id from list_projects"),
				status: z
					.enum(["open", "resolved", "escalated", "all"])
					.optional()
					.describe("Status view (default open)"),
				search: z
					.string()
					.optional()
					.describe("Full-text search over messages, names, and emails"),
				limit: z.number().int().min(1).max(100).optional(),
			},
		},
		handle(({ projectId, ...q }) => client.listConversations(projectId, q)),
	);

	server.registerTool(
		"conversation_stats",
		{
			description:
				"Conversation counts for a project (open / escalated / resolved) — a quick inbox health check.",
			inputSchema: {
				projectId: z.string().describe("Project id from list_projects"),
			},
		},
		handle(({ projectId }) => client.conversationStats(projectId)),
	);

	server.registerTool(
		"get_conversation",
		{
			description:
				"Read a conversation's message thread (visitor, AI, and operator messages, newest page by default). " +
				"Pass `before` (a message sequence number) to page back through older messages.",
			inputSchema: {
				projectId: z.string(),
				conversationId: z.string(),
				limit: z.number().int().min(1).max(100).optional(),
				before: z
					.number()
					.int()
					.optional()
					.describe("Load messages with sequence < this (paging upward)"),
			},
		},
		handle(({ projectId, conversationId, ...q }) =>
			client.getConversation(projectId, conversationId, q),
		),
	);

	server.registerTool(
		"reply_to_conversation",
		{
			description:
				"Send an operator reply to the CUSTOMER in a conversation. This is customer-visible " +
				"(it appears in their widget, and threads over email on escalated conversations) — " +
				"confirm the text with the user before sending. For team-only context use add_internal_note.",
			inputSchema: {
				projectId: z.string(),
				conversationId: z.string(),
				content: z.string().min(1).max(10_000).describe("Reply text"),
			},
		},
		handle(({ projectId, conversationId, content }) =>
			client.reply(projectId, conversationId, content),
		),
	);

	server.registerTool(
		"add_internal_note",
		{
			description:
				"Attach a team-only internal note to a conversation. Never shown to the customer — " +
				"use for context, debugging findings, or handoff notes.",
			inputSchema: {
				projectId: z.string(),
				conversationId: z.string(),
				content: z.string().min(1).max(10_000).describe("Note text"),
			},
		},
		handle(({ projectId, conversationId, content }) =>
			client.addNote(projectId, conversationId, content),
		),
	);

	server.registerTool(
		"list_knowledge_sources",
		{
			description:
				"List a project's knowledge base sources (url / text / qa) — what the AI answers from.",
			inputSchema: { projectId: z.string() },
		},
		handle(({ projectId }) => client.listSources(projectId)),
	);

	server.registerTool(
		"add_knowledge_source",
		{
			description:
				"Add a knowledge base source the AI will answer from. kind 'url' needs `url`; " +
				"kind 'text' needs `content` (docs snippet, changelog, policy); " +
				"kind 'qa' needs `question` + `answer` (a canned Q&A). " +
				"New sources are active immediately for future AI answers.",
			inputSchema: {
				projectId: z.string(),
				kind: z.enum(["url", "text", "qa"]),
				url: z.string().optional().describe("For kind 'url'"),
				title: z.string().max(200).optional(),
				content: z.string().max(50_000).optional().describe("For kind 'text'"),
				question: z.string().max(2_000).optional().describe("For kind 'qa'"),
				answer: z.string().max(8_000).optional().describe("For kind 'qa'"),
			},
		},
		handle(({ projectId, kind, url, title, content, question, answer }) => {
			if (kind === "url") {
				if (!url) throw new Error("kind 'url' requires `url`");
				return client.addUrlSource(projectId, { url, title });
			}
			if (kind === "text") {
				if (!content) throw new Error("kind 'text' requires `content`");
				return client.addTextSource(projectId, { content, title });
			}
			if (!question || !answer) {
				throw new Error("kind 'qa' requires `question` and `answer`");
			}
			return client.addQaSource(projectId, { question, answer });
		}),
	);

	server.registerTool(
		"search",
		{
			description:
				"Workspace-wide search across conversations (message bodies, visitor names, emails) and project names — the same search the dashboard's ⌘K palette uses.",
			inputSchema: {
				query: z.string().min(2).describe("Search term (min 2 chars)"),
			},
		},
		handle(({ query }) => client.search(query)),
	);

	return server;
}
