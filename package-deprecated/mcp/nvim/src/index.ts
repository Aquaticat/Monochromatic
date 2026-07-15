#!/usr/bin/env node
import {
  createMcpServer,
  defineTool,
  serve,
} from '@monochromatic-dev/mcp-stdio';

import { handleGetAllDiagnostics, } from './tool-get-all-diagnostics.ts';
import { handleGetDiagnostics, } from './tool-get-diagnostics.ts';

/**
 * MCP server exposing Neovim diagnostics merged with CLI lint results.
 */
const server = createMcpServer({
  config: {
    name: 'nvim',
    version: '0.1.0',
  },
  tools: [
    defineTool({
      name: 'get_diagnostics',
      entry: {
        description: 'Returns the current buffer from every running Neovim instance, '
          + 'with diagnostics from both LSP and oxlint CLI (merged and deduplicated). '
          + 'Each diagnostic includes severity (ERROR/WARN/INFO/HINT), line, column, message, source, and code.',
        handler: handleGetDiagnostics,
      },
    },),

    defineTool({
      name: 'get_all_diagnostics',
      entry: {
        description:
          'Returns diagnostics from both LSP and oxlint CLI across all buffers in every running Neovim instance, '
          + 'merged and deduplicated, grouped by file path. '
            + 'Use when you need a project-wide view of errors and warnings.',
        handler: handleGetAllDiagnostics,
      },
    },),
  ],
},);

await serve({ server, },);
