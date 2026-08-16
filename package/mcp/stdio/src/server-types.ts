// Type definitions for MCP server configuration, tool entries, the server handle,
// and the dispatch sentinel that distinguishes "no reply" from a real outbound message.

import type {
  CacheHint,
  ServerCapabilities,
} from './protocol.ts';

import type {
  ToolAnnotations,
  ToolDefinition,
  ToolHandler,
  ToolOutputSchema,
} from './protocol-tool.ts';

import type { ToolArgumentsSchema, } from './tool-schema.ts';

import type {
  JsonRpcInbound,
  JsonRpcOutbound,
} from './json-rpc.ts';

//region Dispatch outcome: outbound reply or the no-reply sentinel

/**
 * Sentinel returned from message dispatch when an inbound notification yields no reply.
 * A unique `Symbol` rather than `undefined`/`null`: notifications are a real protocol state
 * ("handled, nothing to send"), distinct from any value the transport could mistake for a reply.
 */
export const NO_RESPONSE: unique symbol = Symbol('MCP notification produced no response message',);

/**
 * Outcome of dispatching one inbound message: either an outbound JSON-RPC reply,
 * or {@link NO_RESPONSE} when the message was a notification expecting no reply.
 */
export type DispatchResult = JsonRpcOutbound | typeof NO_RESPONSE;

//endregion

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
  readonly title?: string;
  readonly description: string;
  readonly schema: ToolArgumentsSchema;
  readonly outputSchema?: ToolOutputSchema;
  readonly annotations?: ToolAnnotations;
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

  /**
   * Schema the definition was derived from, reused to gate each call against exactly what
   * was advertised.
   */
  readonly schema: ToolArgumentsSchema;
};

//endregion

//region Server configuration: identity and discovery payload

/**
 * Configuration for creating an MCP server.
 * `instructions` reaches the model as natural-language guidance about this server,
 * so it should explain what tool descriptions cannot rather than repeat them.
 * Both cache hints default to {@link DEFAULT_CACHE_HINT}.
 *
 * @example
 * ```ts
 * const config: McpServerConfig = {
 *   name: 'my-server',
 *   version: '1.0.0',
 *   instructions: 'Prefer list_vms before acting on a VM by name.',
 * };
 * ```
 */
export type McpServerConfig = {
  readonly name: string;
  readonly version: string;
  readonly title?: string;
  readonly instructions?: string;
  readonly capabilities?: ServerCapabilities;
  readonly discoverCache?: CacheHint;
  readonly toolsCache?: CacheHint;
};

//endregion

//region Server handle: returned by createMcpServer

/**
 * Immutable MCP server handle exposing only the message dispatch function.
 * Created by {@link createMcpServer} and consumed by {@link serve}.
 *
 * @example
 * ```ts
 * const server: McpServerHandle = createMcpServer({ config, tools });
 * const response = await server.handleMessage(inboundMessage);
 * ```
 */
export type McpServerHandle = {
  readonly handleMessage: (
    message: JsonRpcInbound,
  ) => DispatchResult | Promise<DispatchResult>;
};

//endregion
