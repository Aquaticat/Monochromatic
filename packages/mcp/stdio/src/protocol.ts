// MCP protocol types for initialization, capabilities, and tool definitions (spec revision 2025-03-26).
// Justification for >100 lines: pure type definitions with required TSDoc on each;
// further splitting would fragment a single cohesive set of protocol types.

//region Protocol version and server capabilities

/**
 * Protocol version string sent during initialization handshake.
 * Server echoes the client's version if supported.
 */
export const PROTOCOL_VERSION = '2025-03-26';

/**
 * Tools capability sub-object declared in {@link ServerCapabilities}.
 * `listChanged` signals that the server emits `notifications/tools/list_changed`
 * when its tool set mutates; a stdio server with a fixed registry omits it.
 *
 * @example
 * ```ts
 * const tools: ToolsCapability = {};
 * ```
 */
export type ToolsCapability = {
  readonly listChanged?: boolean;
};

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
  readonly tools?: ToolsCapability;
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

//endregion

//region Tool definitions and handlers: describes tools exposed to MCP clients

/**
 * JSON Schema subset describing tool input parameters.
 * Kept intentionally loose; servers provide arbitrary JSON Schema objects.
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
  readonly properties?: Readonly<Record<string, unknown>>;
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
 *   inputSchema: { type: 'object' },
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
 *
 * @returns Tool execution result containing content items.
 *
 * @example
 * ```ts
 * const handler: ToolHandler = async (args) => ({
 *   content: [{ type: 'text', text: `Got: ${JSON.stringify(args)}` }],
 * });
 * ```
 */
export type ToolHandler = (
  args: Readonly<Record<string, unknown>>,
) => ToolCallResult | Promise<ToolCallResult>;

//endregion
