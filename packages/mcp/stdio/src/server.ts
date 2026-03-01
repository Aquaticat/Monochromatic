// MCP server that handles initialization, tool registration, and JSON-RPC dispatch.

import type {
  InitializeResult,
  JsonRpcErrorResponse,
  JsonRpcInbound,
  JsonRpcNotification,
  JsonRpcOutbound,
  JsonRpcRequest,
  JsonRpcResponse,
  ToolCallResult,
  ToolDefinition,
  ToolHandler,
  ToolInputSchema,
} from './types.ts';

import {
  JSON_RPC_INTERNAL_ERROR,
  JSON_RPC_INVALID_PARAMS,
  JSON_RPC_METHOD_NOT_FOUND,
  PROTOCOL_VERSION,
} from './types.ts';

//region Tool registration -- stores tool metadata alongside handlers

/**
 * Registered tool combining its wire-format definition with the runtime handler.
 *
 * @example
 * ```ts
 * const tool: RegisteredTool = {
 *   definition: { name: 'ping', description: 'Returns pong.' },
 *   handler: async () => ({ content: [{ type: 'text', text: 'pong' }] }),
 * };
 * ```
 */
type RegisteredTool = {
  readonly definition: ToolDefinition;
  readonly handler: ToolHandler;
};

//endregion

//region Server configuration -- identity passed during initialization

/**
 * Configuration for creating an MCP server instance.
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

//region Tool registration options -- describes a tool for registration

/**
 * Options for registering a tool on the server.
 *
 * @example
 * ```ts
 * const options: ToolOptions = {
 *   description: 'Fetches diagnostics.',
 *   handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
 * };
 * ```
 */
export type ToolOptions = {
  readonly description: string;
  readonly inputSchema?: ToolInputSchema;
  readonly handler: ToolHandler;
};

//endregion

//region McpServer class -- the primary API surface

/**
 * Minimal MCP server supporting tool registration and JSON-RPC dispatch over stdio.
 * Handles the `initialize` / `initialized` handshake, `tools/list`, `tools/call`, and `ping`.
 *
 * @example
 * ```ts
 * import { McpServer } from '@monochromatic-dev/mcp-stdio';
 *
 * const server = new McpServer({ name: 'demo', version: '0.1.0' });
 * server.tool('greet', {
 *   description: 'Greets by name.',
 *   handler: async (args) => ({
 *     content: [{ type: 'text', text: `Hello, ${args.name}!` }],
 *   }),
 * });
 * ```
 */
export class McpServer {
  readonly #config: McpServerConfig;
  readonly #tools: Map<string, RegisteredTool> = new Map();

  /**
   * @param config - Server identity used in initialization responses.
   *
   * @example
   * ```ts
   * const server = new McpServer({ name: 'my-mcp', version: '0.1.0' });
   * ```
   */
  constructor(config: McpServerConfig) {
    this.#config = config;
  }

  /**
   * Registers a tool that clients can discover via `tools/list` and invoke via `tools/call`.
   *
   * @param name - Unique tool identifier exposed to clients.
   * @param options - Tool metadata and handler function.
   *
   * @example
   * ```ts
   * server.tool('get_time', {
   *   description: 'Returns current UTC time.',
   *   handler: async () => ({
   *     content: [{ type: 'text', text: new Date().toISOString() }],
   *   }),
   * });
   * ```
   */
  tool(name: string, options: ToolOptions): void {
    // MCP clients (including Factory Droid) require `inputSchema` on every tool,
    // even when the tool accepts no arguments. Default to an empty object schema.
    const definition: ToolDefinition = {
      name,
      description: options.description,
      inputSchema: options.inputSchema ?? { type: 'object' },
    };
    this.#tools.set(name, { definition, handler: options.handler });
  }

  /**
   * Dispatches a parsed JSON-RPC message to the appropriate handler.
   * Returns a response for requests, or `undefined` for notifications.
   *
   * @param message - Parsed inbound JSON-RPC request or notification.
   * @returns JSON-RPC response for requests; `undefined` for notifications.
   *
   * @example
   * ```ts
   * const response = await server.handleMessage({
   *   jsonrpc: '2.0',
   *   id: 1,
   *   method: 'tools/list',
   * });
   * ```
   */
  async handleMessage(message: JsonRpcInbound): Promise<JsonRpcOutbound | undefined> {
    // Notifications (no `id`) require no response.
    if (!('id' in message)) {
      return this.#handleNotification(message);
    }
    return this.#handleRequest(message);
  }

  /**
   * Processes notifications. Currently only `notifications/initialized` is expected.
   *
   * @param _notification - Inbound notification (consumed but not acted upon).
   * @returns Always `undefined` since notifications produce no response.
   */
  #handleNotification(_notification: JsonRpcNotification): undefined {
    // `notifications/initialized` signals the client is ready. Nothing to do server-side.
    return undefined;
  }

  /**
   * Routes a JSON-RPC request to the matching method handler.
   *
   * @param request - Inbound request with an `id` that must be echoed in the response.
   * @returns JSON-RPC success or error response.
   */
  async #handleRequest(request: JsonRpcRequest): Promise<JsonRpcOutbound> {
    const { id, method } = request;

    switch (method) {
      case 'initialize': {
        return this.#respondSuccess(id, this.#buildInitializeResult());
      }
      case 'ping': {
        return this.#respondSuccess(id, {});
      }
      case 'tools/list': {
        return this.#respondSuccess(id, this.#buildToolsList());
      }
      case 'tools/call': {
        return this.#handleToolCall(request);
      }
      default: {
        return this.#respondError(id, JSON_RPC_METHOD_NOT_FOUND, `Method not found: ${method}`);
      }
    }
  }

  /**
   * Builds the `InitializeResult` payload for the initialization handshake.
   *
   * @returns Server identity and capabilities.
   */
  #buildInitializeResult(): InitializeResult {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: {
        name: this.#config.name,
        version: this.#config.version,
      },
    };
  }

  /**
   * Builds the response payload for `tools/list`.
   *
   * @returns Object containing array of tool definitions.
   */
  #buildToolsList(): { tools: readonly ToolDefinition[] } {
    return {
      tools: Array.from(this.#tools.values()).map((registered) => registered.definition),
    };
  }

  /**
   * Dispatches a `tools/call` request to the registered handler.
   *
   * @param request - Request containing tool `name` and `arguments` in `params`.
   * @returns Tool result wrapped in a JSON-RPC response, or an error if the tool is unknown.
   */
  async #handleToolCall(request: JsonRpcRequest): Promise<JsonRpcOutbound> {
    const { id, params } = request;
    const toolName = params?.name as string | undefined;
    const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};

    if (toolName === undefined || toolName === null) {
      return this.#respondError(id, JSON_RPC_INVALID_PARAMS, 'Missing tool name in tools/call');
    }

    const registered = this.#tools.get(toolName);
    if (registered === undefined) {
      return this.#respondError(id, JSON_RPC_INVALID_PARAMS, `Unknown tool: ${toolName}`);
    }

    try {
      const result: ToolCallResult = await registered.handler(toolArgs);
      return this.#respondSuccess(id, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[mcp-stdio] tool "${toolName}" threw:`, error);
      return this.#respondError(id, JSON_RPC_INTERNAL_ERROR, `Tool execution failed: ${message}`);
    }
  }

  /**
   * Constructs a JSON-RPC success response.
   *
   * @param id - Request id to echo back.
   * @param result - Payload for the `result` field.
   * @returns Formatted JSON-RPC response.
   */
  #respondSuccess(id: JsonRpcRequest['id'], result: unknown): JsonRpcResponse {
    return { jsonrpc: '2.0', id, result };
  }

  /**
   * Constructs a JSON-RPC error response.
   *
   * @param id - Request id to echo back.
   * @param code - Standard JSON-RPC error code.
   * @param message - Human-readable error description.
   * @returns Formatted JSON-RPC error response.
   */
  #respondError(id: JsonRpcRequest['id'], code: number, message: string): JsonRpcErrorResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }
}

//endregion
