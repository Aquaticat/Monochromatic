#!/usr/bin/env node
/**
 * MCP server entry point for mvm; exposes VM operations as MCP tools.
 * @module
 */
import {
  createMcpServer,
  serve,
} from '@monochromatic-dev/mcp-stdio/ts';

import {
  execTool,
  runTool,
} from './tools-exec.ts';
import {
  createTool,
  destroyTool,
} from './tools-lifecycle-mutate.ts';
import {
  listTool,
  updateTool,
} from './tools-lifecycle.ts';
import {
  pullTool,
  pushTool,
} from './tools-transfer.ts';

export {};

//region Server setup: create and serve the MCP server

/**
 * MCP server instance exposing mvm operations as tools, built via
 * {@link createMcpServer}.
 */
const server = createMcpServer({
  config: {
    name: 'mvm',
    version: '0.1.0',
  },
  tools: [
    listTool,
    createTool,
    destroyTool,
    execTool,
    runTool,
    updateTool,
    pushTool,
    pullTool,
  ],
},);

await serve({ server, },);

//endregion Server setup
