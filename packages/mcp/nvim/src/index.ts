#!/usr/bin/env bun
import { createMcpServer, defineTool, serve } from "@monochromatic-dev/mcp-stdio";
import { getDiagnostics, getAllDiagnostics, getCurrentFile } from "./nvim-client.ts";

/** Formats a single diagnostic into a human-readable line. */
function formatDiagnostic(diagnostic: { severity: string; lnum: number; col: number; source: string | null; code: string | number | null; message: string }, indent: string = ''): string {
  const source = diagnostic.source ? ` [${diagnostic.source}${diagnostic.code ? ` ${diagnostic.code}` : ''}]` : '';
  return `${indent}${diagnostic.severity} ${diagnostic.lnum}:${diagnostic.col}${source} ${diagnostic.message}`;
}

const server = createMcpServer(
  { name: "nvim", version: "0.1.0" },
  [
    defineTool("get_diagnostics", {
      description: "Returns the current Neovim buffer's absolute path, filetype, modified status, and LSP diagnostics. Each diagnostic includes severity (ERROR/WARN/INFO/HINT), line, column, message, source, and code.",
      handler: async () => {
        try {
          const file = await getCurrentFile();
          const header = `path: ${file.path}\nfiletype: ${file.filetype}\nmodified: ${file.modified}`;

          const diags = await getDiagnostics();
          if (diags.length === 0) {
            return { content: [{ type: "text", text: `${header}\n\nNo diagnostics in current buffer.` }] };
          }

          const lines = diags.map((diagnostic) => formatDiagnostic(diagnostic));
          return { content: [{ type: "text", text: `${header}\n\n${lines.join("\n")}` }] };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[mcp-nvim] get_diagnostics failed:', err);
          return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
        }
      },
    }),

    defineTool("get_all_diagnostics", {
      description: "Returns LSP diagnostics across all Neovim buffers, grouped by file path. Use when you need a project-wide view of errors and warnings.",
      handler: async () => {
        try {
          const files = await getAllDiagnostics();
          if (files.length === 0) {
            return { content: [{ type: "text", text: "No diagnostics in any buffer." }] };
          }

          const sections = files.map((fileEntry) => {
            const lines = fileEntry.diagnostics.map((diagnostic) => formatDiagnostic(diagnostic, '  '));
            return `${fileEntry.path}\n${lines.join("\n")}`;
          });

          return { content: [{ type: "text", text: sections.join("\n\n") }] };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[mcp-nvim] get_all_diagnostics failed:', err);
          return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
        }
      },
    }),
  ],
);

await serve(server);
