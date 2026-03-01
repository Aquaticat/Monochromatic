// MCP wire protocol types for stdio transport (spec revision 2025-03-26)

//region JSON-RPC 2.0 base types -- foundation for all MCP message exchange

/** Unique request identifier. MCP uses integer or string ids per JSON-RPC 2.0. */
type JsonRpcId = number | string;

/**
 * Inbound JSON-RPC request from client to server.
 *
 * @example
 * ```ts
 * const request: JsonRpcRequest = {
 *   jsonrpc: '2.0',
 *   id: 1,
 *   method: 'tools/list',
 *   params: {},
 * };
 * ```
 */
export type JsonRpcRequest = {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId;
  readonly method: string;
  readonly params?: Record<string, unknown>;
};

/**
 * Inbound JSON-RPC notification from client. Notifications carry no `id` and expect no response.
 *
 * @example
 * ```ts
 * const notification: JsonRpcNotification = {
 *   jsonrpc: '2.0',
 *   method: 'notifications/initialized',
 * };
 * ```
 */
export type JsonRpcNotification = {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: Record<string, unknown>;
};

/**
 * Outbound JSON-RPC success response.
 *
 * @example
 * ```ts
 * const response: JsonRpcResponse = {
 *   jsonrpc: '2.0',
 *   id: 1,
 *   result: { tools: [] },
 * };
 * ```
 */
export type JsonRpcResponse = {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId;
  readonly result: unknown;
};

/**
 * Structured error detail within a JSON-RPC error response.
 *
 * @example
 * ```ts
 * const error: JsonRpcErrorDetail = {
 *   code: -32602,
 *   message: 'Unknown tool: foo',
 * };
 * ```
 */
export type JsonRpcErrorDetail = {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
};

/**
 * Outbound JSON-RPC error response.
 *
 * @example
 * ```ts
 * const errorResponse: JsonRpcErrorResponse = {
 *   jsonrpc: '2.0',
 *   id: 1,
 *   error: { code: -32601, message: 'Method not found' },
 * };
 * ```
 */
export type JsonRpcErrorResponse = {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId;
  readonly error: JsonRpcErrorDetail;
};

/** Any message the server may send back over stdout. */
export type JsonRpcOutbound = JsonRpcResponse | JsonRpcErrorResponse;

/** Any message the server may receive over stdin. */
export type JsonRpcInbound = JsonRpcRequest | JsonRpcNotification;

//endregion

//region Standard JSON-RPC error codes -- used for protocol-level failures

/** Method does not exist or is not available. */
export const JSON_RPC_METHOD_NOT_FOUND = -32601;

/** Invalid method parameters. */
export const JSON_RPC_INVALID_PARAMS = -32602;

/** Internal server error. */
export const JSON_RPC_INTERNAL_ERROR = -32603;

/** Failed to parse JSON. */
export const JSON_RPC_PARSE_ERROR = -32700;

//endregion

//region MCP protocol types -- initialization, capabilities, tool definitions

/**
 * Protocol version string sent during initialization handshake.
 * Server echoes the client's version if supported.
 */
export const PROTOCOL_VERSION = '2025-03-26';

/**
 * Server capabilities declared during initialization.
 * Only `tools` is relevant for a stdio tool server.
 *
 * @example
 * ```ts
 * const capabilities: ServerCapabilities = { tools: {} };
 * ```
 */
export type ServerCapabilities = {
  readonly tools?: Record<string, never>;
};

/**
 * Server identity and capabilities sent in the `initialize` response.
 *
 * @example
 * ```ts
 * const result: InitializeResult = {
 *   protocolVersion: '2025-03-26',
 *   capabilities: { tools: {} },
 *   serverInfo: { name: 'my-server', version: '1.0.0' },
 * };
 * ```
 */
export type InitializeResult = {
  readonly protocolVersion: string;
  readonly capabilities: ServerCapabilities;
  readonly serverInfo: {
    readonly name: string;
    readonly version: string;
  };
};

/**
 * JSON Schema subset describing tool input parameters.
 * Kept intentionally loose -- servers provide arbitrary JSON Schema objects.
 *
 * @example
 * ```ts
 * const schema: ToolInputSchema = {
 *   type: 'object',
 *   properties: { query: { type: 'string' } },
 *   required: ['query'],
 * };
 * ```
 */
export type ToolInputSchema = {
  readonly type: 'object';
  readonly properties?: Record<string, unknown>;
  readonly required?: readonly string[];
};

/**
 * Tool definition exposed to clients via `tools/list`.
 *
 * @example
 * ```ts
 * const tool: ToolDefinition = {
 *   name: 'get_weather',
 *   description: 'Fetches current weather for a location.',
 * };
 * ```
 */
export type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
};

/**
 * Single content item in a tool call result.
 * Text content covers the vast majority of tool responses.
 *
 * @example
 * ```ts
 * const content: ToolContent = { type: 'text', text: 'Hello, world!' };
 * ```
 */
export type ToolContent = {
  readonly type: 'text';
  readonly text: string;
};

/**
 * Result returned from a tool call handler, sent back in the `tools/call` response.
 *
 * @example
 * ```ts
 * const result: ToolCallResult = {
 *   content: [{ type: 'text', text: 'Done.' }],
 * };
 * ```
 */
export type ToolCallResult = {
  readonly content: readonly ToolContent[];
  readonly isError?: boolean;
};

/**
 * Async handler function invoked when a tool is called.
 *
 * @param args - Parsed arguments from the client's `tools/call` request.
 * @returns Tool execution result containing content items.
 *
 * @example
 * ```ts
 * const handler: ToolHandler = async (args) => ({
 *   content: [{ type: 'text', text: `Got: ${JSON.stringify(args)}` }],
 * });
 * ```
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolCallResult>;

//endregion
