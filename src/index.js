#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { KimiApi } from "./kimi-api.js";

const api = new KimiApi();
const server = new McpServer({
  name: "kimi-session-mcp",
  version: "0.0.4",
});

function result(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function failure(error) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({ error: error.message, code: error.code, details: error.details }, null, 2),
    }],
    isError: true,
  };
}

async function handle(callback) {
  try {
    return result(await callback());
  } catch (error) {
    return failure(error);
  }
}

server.registerTool("ListAgents", {
  title: "List Kimi Code sessions",
  description: "List unarchived Kimi Code sessions visible to the local server. Address sessions by exact name or session_ ID. The list can include cold sessions that are not currently loaded.",
  inputSchema: {
    query: z.string().optional().describe("Case-insensitive substring matched against name, ID, and working directory"),
    cwd: z.string().optional().describe("Keep only sessions with this exact working directory"),
    include_archived: z.boolean().default(false).describe("Include archived sessions"),
  },
}, async (args) => handle(async () => {
  const agents = await api.listSessions({
    query: args.query,
    cwd: args.cwd,
    includeArchived: args.include_archived,
  });
  return { count: agents.length, agents };
}));

server.registerTool("SendMessage", {
  title: "Message another Kimi Code session",
  description: "Send plain text to another Kimi Code session. The sender name or ID is required because stdio MCP does not identify the calling session. The message is queued by Kimi; steer=true also lets a running turn consume it immediately. No permissions are transferred.",
  inputSchema: {
    to: z.string().min(1).describe("Recipient's exact session name or session_ ID"),
    from: z.string().min(1).describe("Sender's exact session name or session_ ID"),
    text: z.string().min(1).max(100000).describe("Plain text message; do not include credentials"),
    steer: z.boolean().default(true).describe("Deliver a queued message to the active turn instead of waiting for the next turn"),
  },
}, async (args) => handle(() => api.sendMessage(args)));

server.registerTool("ManageSession", {
  title: "Archive, restore, reload, take over or delete a Kimi Code session",
  description: "Run a session lifecycle action through the Server API colon endpoints: archive (hides from the default list), restore, reload, takeover (break another holder's lock), delete (irreversible, requires confirm=true). Actions map to POST /api/v1/sessions/{id}:{action}.",
  inputSchema: {
    session: z.string().min(1).describe("Exact session name or session_ ID"),
    action: z.enum(["archive", "restore", "reload", "takeover", "delete"]).describe("Lifecycle action to run"),
    confirm: z.boolean().default(false).describe('Required to be true for the irreversible "delete" action'),
  },
}, async (args) => handle(() => api.manageSession(args)));

server.registerTool("GetMessages", {
  title: "Read Kimi Code session messages",
  description: "Read recent text messages from a session, newest first. Useful for collecting another session's reply; it does not mark messages as read.",
  inputSchema: {
    session: z.string().min(1).describe("Exact session name or session_ ID"),
    limit: z.number().int().min(1).max(100).default(10).describe("Maximum number of messages"),
    after_id: z.string().optional().describe("Return messages newer than this message ID"),
  },
}, async (args) => handle(() => api.getMessages({
  session: args.session,
  limit: args.limit,
  afterId: args.after_id,
})));

await server.connect(new StdioServerTransport());
