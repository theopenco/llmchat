# @clankersupport/mcp

The official [Clanker Support](https://clankersupport.com) MCP server — work your support inbox from Claude Code, Codex, or any [Model Context Protocol](https://modelcontextprotocol.io) client.

Your coding agent can read escalated conversations, draft and send replies, leave internal notes for your team, search across every conversation, and keep the AI's knowledge base up to date — without you leaving the terminal. Fix a bug a customer reported, then answer them and add the fix to the knowledge base, all in one session.

## Setup

You need a Clanker Support operator account (the one you use for the dashboard, or a dedicated automation account — recommended, with the least role that covers what you'll do).

### Claude Code

```sh
claude mcp add clanker-support \
  --env CLANKER_EMAIL=you@company.com \
  --env CLANKER_PASSWORD=your-password \
  -- npx -y @clankersupport/mcp
```

Or, to share the connector with your team via a project-scoped `.mcp.json` (keep credentials out of it — reference environment variables instead):

```json
{
	"mcpServers": {
		"clanker-support": {
			"command": "npx",
			"args": ["-y", "@clankersupport/mcp"],
			"env": {
				"CLANKER_EMAIL": "${CLANKER_EMAIL}",
				"CLANKER_PASSWORD": "${CLANKER_PASSWORD}"
			}
		}
	}
}
```

### Codex

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.clanker-support]
command = "npx"
args = ["-y", "@clankersupport/mcp"]
env = { CLANKER_EMAIL = "you@company.com", CLANKER_PASSWORD = "your-password" }
```

### Any other MCP client

Run `npx -y @clankersupport/mcp` over stdio with the environment variables below.

## Configuration

| Variable               | Required | Default                          | What it does                                                                                                          |
| ---------------------- | -------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `CLANKER_EMAIL`        | yes      | —                                | Operator account email                                                                                                |
| `CLANKER_PASSWORD`     | yes      | —                                | Operator account password (stays in your local MCP client config; sent only to the API)                               |
| `CLANKER_API_URL`      | no       | `https://api.clankersupport.com` | Point at your own deployment when self-hosting (e.g. `http://localhost:8787`)                                         |
| `CLANKER_WORKSPACE_ID` | no       | auto                             | Pin a workspace. Defaults to your only workspace, or the one with the most projects — `list_workspaces` shows the ids |

## Tools

| Tool                     | What it does                                                                  |
| ------------------------ | ----------------------------------------------------------------------------- |
| `list_workspaces`        | Workspaces this account belongs to, with role and project count               |
| `list_projects`          | Support projects in the active workspace                                      |
| `list_conversations`     | Conversations in a project — filter by open / escalated / resolved, or search |
| `conversation_stats`     | Open / escalated / resolved counts for a project                              |
| `get_conversation`       | A conversation's full message thread                                          |
| `reply_to_conversation`  | Send an operator reply to the customer (customer-visible)                     |
| `add_internal_note`      | Team-only note on a conversation — never shown to the customer                |
| `list_knowledge_sources` | The project's knowledge base (url / text / qa sources)                        |
| `add_knowledge_source`   | Add a docs URL, text snippet, or Q&A pair the AI will answer from             |
| `search`                 | Workspace-wide search — the same one the dashboard's ⌘K palette uses          |

Replies are customer-visible: a well-behaved agent will show you the draft before calling `reply_to_conversation`, and the tool description tells it to.

## Self-hosting

Everything works against your own deployment — set `CLANKER_API_URL` to your API origin. Requires an API build that trusts its own origin for sign-in (any build from July 2026 on).

## License

MIT
