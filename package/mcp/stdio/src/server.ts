// MCP server: immutable tool registry and JSON-RPC dispatch for spec revision 2026-07-28.

import {
  JSON_RPC_METHOD_NOT_FOUND,
  type JsonRpcInbound,
  type JsonRpcOutbound,
  type JsonRpcRequest,
} from './json-rpc.ts';

import { DEFAULT_CACHE_HINT, } from './protocol.ts';

import type { Implementation, } from './protocol-meta.ts';

import {
  buildDiscoverResult,
  buildListToolsResult,
} from './server-result.ts';

import {
  handleNotification,
  respondError,
  respondInitializeRemoved,
  respondMissingProtocolVersion,
  respondSuccess,
  respondUnsupportedProtocolVersion,
} from './server-response.ts';
import { handleToolCall, } from './server-tool-call.ts';
import { registerTools, } from './server-tool-registry.ts';
import type {
  DispatchResult,
  McpServerConfig,
  McpServerHandle,
  ToolEntry,
} from './server-types.ts';
import { requireProtocolVersion, } from './server-request-version.ts';
import {
  MissingProtocolVersionError,
  UnsupportedProtocolVersionError,
} from './server-protocol-error.ts';

//region createMcpServer: builds an immutable server from config and tool entries

/**
 * Creates an immutable MCP server that dispatches JSON-RPC messages.
 * Tools are registered at creation time; no mutation after construction.
 *
 * @param config - Server identity and discovery payload.
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
 *         schema: v.strictObject({ name: v.string() }),
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
   */
  const toolMap = registerTools({ tools, },);

  /**
   * Identity stamped into the `_meta` of every result this server sends.
   */
  const serverInfo: Implementation = {
    name: config.name,
    version: config.version,
    ...((config.title === undefined) ? {} : { title: config.title, }),
  };

  //region Request dispatch: routes JSON-RPC methods to handlers

  /**
   * Routes a version-checked request to the matching method handler.
   *
   * @param request - Inbound request whose declared revision this server implements.
   *
   * @returns JSON-RPC success or error response.
   */
  function routeRequest(request: JsonRpcRequest,): Promise<JsonRpcOutbound> {
    /**
     * Request `id` is echoed in the response; `method` selects the branch below.
     */
    const {
      id,
      method,
    } = request;

    if (method === 'server/discover') {
      return Promise.resolve(respondSuccess({
        id,
        result: buildDiscoverResult({
          serverInfo,
          capabilities: config.capabilities ?? { tools: {}, },
          cache: config.discoverCache ?? DEFAULT_CACHE_HINT,
          ...((config.instructions === undefined) ? {} : { instructions: config.instructions, }),
        },),
      },),);
    }
    if (method === 'tools/list') {
      return Promise.resolve(respondSuccess({
        id,
        result: buildListToolsResult({
          tools: [...toolMap.values(),].map(function getDefinition(registered,) {
            return registered.definition;
          },),
          serverInfo,
          cache: config.toolsCache ?? DEFAULT_CACHE_HINT,
        },),
      },),);
    }
    if (method === 'tools/call') {
      return handleToolCall({
        toolMap,
        request,
        serverInfo,
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

  /**
   * Validates the request's declared protocol revision, then routes it.
   * `initialize` short-circuits ahead of validation: a handshake-era client never sends
   * the `_meta` this revision requires, and its error message is its only diagnostic.
   *
   * @param request - Inbound request with an `id` that must be echoed in the response.
   *
   * @returns JSON-RPC success or error response.
   */
  function handleRequest(request: JsonRpcRequest,): Promise<JsonRpcOutbound> {
    if (request.method === 'initialize')
      return Promise.resolve(respondInitializeRemoved({ id: request.id, },),);

    // Deliberate catch-and-return: version validation reports refusal to the client as a
    // JSON-RPC error response rather than crashing the server process.
    try {
      requireProtocolVersion({ request, },);
    }
    catch (error: unknown) {
      if (error instanceof UnsupportedProtocolVersionError) {
        console.error(`[mcp-stdio] refused request: ${error.message}`,);
        return Promise.resolve(
          respondUnsupportedProtocolVersion({
            id: request.id,
            requested: error.requested,
            supported: error.supported,
          },),
        );
      }
      if (error instanceof MissingProtocolVersionError) {
        console.error(`[mcp-stdio] refused request: ${error.message}`,);
        return Promise.resolve(
          respondMissingProtocolVersion({
            id: request.id,
            message: error.message,
          },),
        );
      }
      throw error;
    }

    return routeRequest(request,);
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

//endregion
