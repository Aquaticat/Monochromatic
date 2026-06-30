// MCP server: immutable tool registry and JSON-RPC dispatch.

import {
  JSON_RPC_METHOD_NOT_FOUND,
  type JsonRpcInbound,
  type JsonRpcOutbound,
  type JsonRpcRequest,
} from './json-rpc.ts';

import {
  type InitializeResult,
  PROTOCOL_VERSION,
  type ToolDefinition,
} from './protocol.ts';

import {
  handleNotification,
  respondError,
  respondSuccess,
} from './server-response.ts';
import { handleToolCall, } from './server-tool-call.ts';
import type {
  DispatchResult,
  McpServerConfig,
  McpServerHandle,
  RegisteredTool,
  ToolEntry,
} from './server-types.ts';

//region createMcpServer: builds an immutable server from config and tool entries

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
 * const server = createMcpServer({
 *   config: { name: 'demo', version: '0.1.0' },
 *   tools: [
 *     defineTool({
 *       name: 'greet',
 *       entry: {
 *         description: 'Greets by name.',
 *         handler: async (args) => ({
 *           content: [{ type: 'text', text: `Hello, ${args.name}!` }],
 *         }),
 *       },
 *     }),
 *   ],
 * });
 * await serve({ server });
 * ```
 */
export function createMcpServer(
  {
    config,
    tools,
  }: {
    readonly config: McpServerConfig;
    readonly tools: readonly ToolEntry[];
  },
): McpServerHandle {
  /**
   * Immutable lookup of registered tools keyed by name; built once at construction so
   * later dispatch is O(1) without exposing a mutation surface.
   *
   * MCP clients (including Factory Droid) require `inputSchema` on every tool, even
   * when the tool accepts no arguments; entries without one fall back to `{ type: 'object' }`.
   */
  const toolMap: ReadonlyMap<string, RegisteredTool> = new Map(
    tools.map(function buildRegisteredTool(entry,) {
      return [
        entry.name,
        {
          definition: {
            name: entry.name,
            description: entry.description,
            inputSchema: entry.inputSchema
              ?? { type: 'object', },
          },
          handler: entry.handler,
        },
      ] as const;
    },),
  );

  //region Protocol payloads: initialization and tool listing

  /**
   * Builds the `InitializeResult` payload for the initialization handshake.
   *
   * @returns Server identity and capabilities.
   */
  function buildInitializeResult(): InitializeResult {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {}, },
      serverInfo: {
        name: config.name,
        version: config.version,
      },
    };
  }

  /**
   * Builds the response payload for `tools/list`.
   *
   * @returns Object containing array of tool definitions.
   */
  function buildToolsList(): { tools: readonly ToolDefinition[]; } {
    return {
      tools: [...toolMap.values(),].map(function getDefinition(registered,) {
        return registered.definition;
      },),
    };
  }

  //endregion

  //region Request dispatch: routes JSON-RPC methods to handlers

  /**
   * Routes a JSON-RPC request to the matching method handler.
   * Only the `tools/call` branch is async (awaits the tool handler);
   * all other branches return synchronously but the signature must be
   * async to unify with {@link handleToolCall}.
   *
   * @param request - Inbound request with an `id` that must be echoed in the response.
   *
   * @returns JSON-RPC success or error response.
   */
  function handleRequest(request: JsonRpcRequest,): Promise<JsonRpcOutbound> {
    /**
     * Request `id` is echoed in the response; `method` selects the branch below.
     */
    const {
      id,
      method,
    } = request;

    if (method === 'initialize') {
      return Promise.resolve(respondSuccess({
        id,
        result: buildInitializeResult(),
      },),);
    }
    if (method === 'ping') {
      return Promise.resolve(respondSuccess({
        id,
        result: {},
      },),);
    }
    if (method === 'tools/list') {
      return Promise.resolve(respondSuccess({
        id,
        result: buildToolsList(),
      },),);
    }
    if (method === 'tools/call') {
      return handleToolCall({
        toolMap,
        request,
      },);
    }
    return Promise.resolve(
      respondError({
        id,
        code: JSON_RPC_METHOD_NOT_FOUND,
        message: `Method not found: ${method}`,
      },),
    );
  }

  //endregion

  //region Public handle: single dispatch function exposed to the transport

  /**
   * Dispatches a parsed JSON-RPC message to the appropriate handler.
   * Returns a response for requests, or delegates to {@link handleNotification} for notifications.
   *
   * @param message - Parsed inbound JSON-RPC request or notification.
   *
   * @returns JSON-RPC response for requests; the {@link NO_RESPONSE} sentinel for notifications.
   */
  function handleMessage(message: JsonRpcInbound,): Promise<DispatchResult> {
    if (!('id' in message)) {
      return Promise.resolve(handleNotification(message,),);
    }
    return handleRequest(message,);
  }

  return { handleMessage, };

  //endregion
}
