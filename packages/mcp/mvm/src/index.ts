#!/usr/bin/env bun
/**
 * MCP server entry point for mvm -- exposes VM operations as MCP tools.
 * @module
 */
import { createMcpServer, serve } from '@monochromatic-dev/mcp-stdio';

import { execTool, runTool } from './tools-exec.ts';
import { createTool, destroyTool, listTool, updateTool } from './tools-lifecycle.ts';

export {};

//region Server setup -- create and serve the MCP server

/** MCP server instance exposing mvm operations as tools. */
const server = createMcpServer(
  { name: 'mvm', version: '0.1.0' },
  [listTool, createTool, destroyTool, execTool, runTool, updateTool],
);

await serve(server);

//endregion Server setup
