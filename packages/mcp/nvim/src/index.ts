#!/usr/bin/env bun
import { McpServer, serve } from "@monochromatic-dev/mcp-stdio";
import { getDiagnostics, getAllDiagnostics, getCurrentFile } from "./nvim-client.ts";

const server = new McpServer({
  name: "nvim",
  version: "0.1.0",
});

server.tool("get_diagnostics", {
  description: "Returns the current Neovim buffer's absolute path, filetype, modified status, and LSP diagnostics. Each diagnostic includes severity (ERROR/WARN/INFO/HINT), line, column, message, source, and code.",
  handler: async () => {
    try {
      const file = await getCurrentFile();
      const header = `path: ${file.path}\nfiletype: ${file.filetype}\nmodified: ${file.modified}`;

      const diags = await getDiagnostics();
      if (diags.length === 0) {
        return { content: [{ type: "text", text: `${header}\n\nNo diagnostics in current buffer.` }] };
      }

      const lines = diags.map(
        (d) =>
          `${d.severity} ${d.lnum}:${d.col}${d.source ? ` [${d.source}${d.code ? ` ${d.code}` : ""}]` : ""} ${d.message}`,
      );

      return { content: [{ type: "text", text: `${header}\n\n${lines.join("\n")}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err}` }], isError: true };
    }
  },
});

server.tool("get_all_diagnostics", {
  description: "Returns LSP diagnostics across all Neovim buffers, grouped by file path. Use when you need a project-wide view of errors and warnings.",
  handler: async () => {
    try {
      const files = await getAllDiagnostics();
      if (files.length === 0) {
        return { content: [{ type: "text", text: "No diagnostics in any buffer." }] };
      }

      const sections = files.map((f) => {
        const lines = f.diagnostics.map(
          (d) =>
            `  ${d.severity} ${d.lnum}:${d.col}${d.source ? ` [${d.source}${d.code ? ` ${d.code}` : ""}]` : ""} ${d.message}`,
        );
        return `${f.path}\n${lines.join("\n")}`;
      });

      return { content: [{ type: "text", text: sections.join("\n\n") }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err}` }], isError: true };
    }
  },
});

await serve(server);
