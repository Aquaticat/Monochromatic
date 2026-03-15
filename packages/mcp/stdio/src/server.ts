// MCP server: immutable tool registry and JSON-RPC dispatch.

import {
  JSON_RPC_INTERNAL_ERROR,
  JSON_RPC_INVALID_PARAMS,
  JSON_RPC_METHOD_NOT_FOUND,
  type JsonRpcInbound,
  type JsonRpcOutbound,
  type JsonRpcRequest,
} from './json-rpc.ts';

import {
  PROTOCOL_VERSION,
  type InitializeResult,
  type ToolCallResult,
  type ToolDefinition,
} from './protocol.ts';

import type { McpServerConfig, McpServerHandle, RegisteredTool, ToolEntry } from './server-types.ts';
import { handleNotification, respondError, respondSuccess } from './server-response.ts';

//region defineTool -- convenience for declaring tool entries

/**
 * Declares a named tool entry for passing to {@link createMcpServer}.
 * Pure convenience: validates nothing, just bundles name with options.
 *
 * @param name - Unique tool identifier exposed to clients.
 *
 * @param entry - Tool metadata and handler, without the `name` field.
 *
 * @returns Complete tool entry ready for server creation.
 *
 * @example
 * ```ts
 * const tool = defineTool('get_time', {
 *   description: 'Returns current UTC time.',
 *   handler: async () => ({
 *     content: [{ type: 'text', text: new Date().toISOString() }],
 *   }),
 * });
 * ```
 */
export function defineTool(name: string, entry: Omit<ToolEntry, 'name'>): ToolEntry {
  return { name, ...entry };
}

//endregion

//region createMcpServer -- builds an immutable server from config and tool entries

/**
 * Creates an immutable MCP server that dispatches JSON-RPC messages.
 * Tools are registered at creation time; no mutation after construction.
 *
 * @param config - Server identity used in initialization responses.
 *
 * @param tools - Tool entries to register, typically created via {@link defineTool}.
 *
 * @returns Server handle with a `handleMessage` function for the transport layer.
 *
 * @example
 * ```ts
 * import { createMcpServer, defineTool, serve } from '\@monochromatic-dev/mcp-stdio';
 *
 * const server = createMcpServer(
 *   { name: 'demo', version: '0.1.0' },
 *   [
 *     defineTool('greet', {
 *       description: 'Greets by name.',
 *       handler: async (args) => ({
 *         content: [{ type: 'text', text: `Hello, ${args.name}!` }],
 *       }),
 *     }),
 *   ],
 * );
 * await serve(server);
 * ```
 */
export function createMcpServer(
  config: McpServerConfig,
  tools: readonly ToolEntry[],
): McpServerHandle {
  // Build an immutable tool lookup from the entry list.
  // MCP clients (including Factory Droid) require `inputSchema` on every tool,
  // even when the tool accepts no arguments. Default to an empty object schema.
  const toolMap: ReadonlyMap<string, RegisteredTool> = new Map(
    tools.map(function buildRegisteredTool(entry) {
      return [
        entry.name,
        {
          definition: {
            name: entry.name,
            description: entry.description,
            inputSchema: entry.inputSchema ?? { type: 'object' },
          },
          handler: entry.handler,
        },
      ] as const;
    }),
  );

  //region Protocol payloads -- initialization and tool listing

  /**
   * Builds the `InitializeResult` payload for the initialization handshake.
   *
   * @returns Server identity and capabilities.
   */
  function buildInitializeResult(): InitializeResult {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: config.name, version: config.version },
    };
  }

  /**
   * Builds the response payload for `tools/list`.
   *
   * @returns Object containing array of tool definitions.
   */
  function buildToolsList(): { tools: readonly ToolDefinition[] } {
    return {
      tools: [...toolMap.values()].map(function getDefinition(registered) { return registered.definition; }),
    };
  }

  //endregion

  //region Request dispatch -- routes JSON-RPC methods to handlers

  /**
   * Dispatches a `tools/call` request to the registered handler.
   * Validates tool name and arguments from untrusted client input before dispatch.
   *
   * @param request - Request containing tool `name` and `arguments` in `params`.
   *
   * @returns Tool result wrapped in a JSON-RPC response, or an error if the tool is unknown.
   */
  async function handleToolCall(request: JsonRpcRequest): Promise<JsonRpcOutbound> {
    const { id, params } = request;

    // Validate tool name is a string rather than blindly casting untrusted input.
    const toolName = typeof params?.name === 'string' ? params.name : undefined;
    if (toolName === undefined) {
      return respondError(id, JSON_RPC_INVALID_PARAMS, 'Missing or non-string tool name in tools/call');
    }

    // Validate arguments is a plain object when present, default to empty object otherwise.
    const rawArgs = params?.arguments;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed from unknown to non-array object above
    const toolArgs: Record<string, unknown> =
      rawArgs !== undefined && rawArgs !== null && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
        ? (rawArgs as Record<string, unknown>)
        : {};

    const registered = toolMap.get(toolName);
    if (registered === undefined) {
      return respondError(id, JSON_RPC_INVALID_PARAMS, `Unknown tool: ${toolName}`);
    }

    // Deliberate catch-and-return: in a server context, tool handler errors must be
    // reported as JSON-RPC error responses rather than crashing the server process.
    try {
      const result: ToolCallResult = await registered.handler(toolArgs);
      return respondSuccess(id, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[mcp-stdio] tool "${toolName}" threw:`, error);
      return respondError(id, JSON_RPC_INTERNAL_ERROR, `Tool execution failed: ${message}`);
    }
  }

  /**
   * Routes a JSON-RPC request to the matching method handler.
   * Only the `tools/call` branch is async (awaits the tool handler);
   * all other branches return synchronously but the signature must be
   * async to unify with `handleToolCall`.
   *
   * @param request - Inbound request with an `id` that must be echoed in the response.
   *
   * @returns JSON-RPC success or error response.
   */
  function handleRequest(request: JsonRpcRequest): Promise<JsonRpcOutbound> {
    const { id, method } = request;

    if (method === 'initialize') {
      return Promise.resolve(respondSuccess(id, buildInitializeResult()));
    }
    if (method === 'ping') {
      return Promise.resolve(respondSuccess(id, {}));
    }
    if (method === 'tools/list') {
      return Promise.resolve(respondSuccess(id, buildToolsList()));
    }
    if (method === 'tools/call') {
      return handleToolCall(request);
    }
    return Promise.resolve(respondError(id, JSON_RPC_METHOD_NOT_FOUND, `Method not found: ${method}`));
  }

  //endregion

  //region Public handle -- single dispatch function exposed to the transport

  /**
   * Dispatches a parsed JSON-RPC message to the appropriate handler.
   * Returns a response for requests, or `undefined` for notifications.
   *
   * @param message - Parsed inbound JSON-RPC request or notification.
   *
   * @returns JSON-RPC response for requests; `undefined` for notifications.
   */
  function handleMessage(message: JsonRpcInbound): Promise<JsonRpcOutbound | undefined> {
    if (!('id' in message)) {
      handleNotification(message);
      // oxlint-disable-next-line unicorn/no-useless-undefined -- explicit undefined needed to satisfy Promise<JsonRpcOutbound | undefined> return type
      return Promise.resolve(undefined);
    }
    return handleRequest(message);
  }

  return { handleMessage };

  //endregion
}
