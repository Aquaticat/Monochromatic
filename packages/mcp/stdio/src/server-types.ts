// Type definitions for MCP server configuration, tool entries, and the server handle.

import type {
  ToolDefinition,
  ToolHandler,
  ToolInputSchema,
} from './protocol.ts';

import type {
  JsonRpcInbound,
  JsonRpcOutbound,
} from './json-rpc.ts';

//region Tool entry: pairs a name with its options for immutable registration

/**
 * Named tool entry passed to {@link createMcpServer}.
 * Produced by {@link defineTool} to ensure consistent defaults.
 *
 * @example
 * ```ts
 * const entry: ToolEntry = {
 *   name: 'ping',
 *   description: 'Returns pong.',
 *   handler: async () => ({ content: [{ type: 'text', text: 'pong' }] }),
 * };
 * ```
 */
export type ToolEntry = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: ToolInputSchema;
  readonly handler: ToolHandler;
};

//endregion

//region Registered tool: internal representation after normalization

/**
 * Registered tool combining its wire-format definition with the runtime handler.
 * Created internally from {@link ToolEntry} during server construction.
 *
 * @example
 * ```ts
 * const tool: RegisteredTool = {
 *   definition: { name: 'ping', description: 'Returns pong.', inputSchema: { type: 'object' } },
 *   handler: async () => ({ content: [{ type: 'text', text: 'pong' }] }),
 * };
 * ```
 */
export type RegisteredTool = {
  readonly definition: ToolDefinition;
  readonly handler: ToolHandler;
};

//endregion

//region Server configuration: identity passed during initialization

/**
 * Configuration for creating an MCP server.
 *
 * @example
 * ```ts
 * const config: McpServerConfig = { name: 'my-server', version: '1.0.0' };
 * ```
 */
export type McpServerConfig = {
  readonly name: string;
  readonly version: string;
};

//endregion

//region Server handle: returned by createMcpServer

/**
 * Immutable MCP server handle exposing only the message dispatch function.
 * Created by {@link createMcpServer} and consumed by {@link serve}.
 *
 * @example
 * ```ts
 * const server: McpServerHandle = createMcpServer(config, tools);
 * const response = await server.handleMessage(inboundMessage);
 * ```
 */
export type McpServerHandle = {
  readonly handleMessage: (
    message: JsonRpcInbound,
  ) => JsonRpcOutbound | undefined | Promise<JsonRpcOutbound | undefined>;
};

//endregion
