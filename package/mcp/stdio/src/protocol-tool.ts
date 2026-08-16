// Tool definition, content, and handler types for MCP spec revision 2026-07-28.
// Revision 2026-07-28 made `description` optional and added `title`, `outputSchema`,
// `annotations`, and structured tool output.

//region Tool schemas: how a tool declares its arguments and its structured output

/**
 * JSON Schema subset describing tool input parameters.
 * Kept intentionally loose; servers provide arbitrary JSON Schema 2020-12 objects,
 * and the root must be an object because tool arguments are always a JSON object.
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
  readonly $schema?: string;
};

/**
 * JSON Schema describing what a tool places in `structuredContent`.
 * Unconstrained at the root because structured output may be any JSON value.
 *
 * @example
 * ```ts
 * const schema: ToolOutputSchema = {
 *   type: 'object',
 *   properties: { exitCode: { type: 'number' } },
 * };
 * ```
 */
export type ToolOutputSchema = Readonly<Record<string, unknown>>;

//endregion

//region Tool definition: what `tools/list` exposes to clients

/**
 * Behavioral hints a client may surface or use to decide how freely to call a tool.
 * Hints are advisory: a client must not treat them as guarantees from an untrusted server.
 *
 * @example
 * ```ts
 * const annotations: ToolAnnotations = { title: 'List VMs', readOnlyHint: true };
 * ```
 */
export type ToolAnnotations = {
  readonly title?: string;
  readonly readOnlyHint?: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint?: boolean;
  readonly openWorldHint?: boolean;
};

/**
 * Tool definition exposed to clients via `tools/list`.
 * Display precedence for a name runs `title`, then `annotations.title`, then `name`.
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
  readonly title?: string;
  readonly description?: string;
  readonly inputSchema: ToolInputSchema;
  readonly outputSchema?: ToolOutputSchema;
  readonly annotations?: ToolAnnotations;
};

//endregion

//region Tool results: what a handler returns and what the server sends back

/**
 * Single content item in a tool call result.
 * Text content covers every response this package produces; a server needing image,
 * audio, or resource blocks would widen this union and the handlers that build it.
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
 * Result returned from a tool call handler.
 * The server stamps protocol envelope fields onto it, so a handler supplies only its payload.
 *
 * Failures inside a tool belong here with `isError` set, not in a JSON-RPC error response:
 * a protocol error hides the failure from the model, which then cannot correct itself.
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
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
};

/**
 * Async handler function invoked when a tool is called.
 *
 * @param args - Parsed arguments from client's `tools/call` request.
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
