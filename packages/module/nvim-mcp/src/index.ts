#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getDiagnostics, getCurrentFile } from "./nvim-client.js";

const server = new McpServer({
  name: "nvim",
  version: "0.1.0",
});

server.tool(
  "get_diagnostics",
  "Returns LSP diagnostics for the current Neovim buffer. Each entry includes severity (ERROR/WARN/INFO/HINT), line, column, message, source, and code.",
  {},
  async () => {
    try {
      const diags = await getDiagnostics();
      if (diags.length === 0) {
        return { content: [{ type: "text", text: "No diagnostics in current buffer." }] };
      }

      const lines = diags.map(
        (d) =>
          `${d.severity} ${d.lnum}:${d.col}${d.source ? ` [${d.source}${d.code ? ` ${d.code}` : ""}]` : ""} ${d.message}`,
      );

      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err}` }], isError: true };
    }
  },
);

server.tool(
  "get_current_file",
  "Returns the absolute path, filetype, and modified status of the current Neovim buffer.",
  {},
  async () => {
    try {
      const file = await getCurrentFile();
      return {
        content: [
          {
            type: "text",
            text: `path: ${file.path}\nfiletype: ${file.filetype}\nmodified: ${file.modified}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err}` }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
