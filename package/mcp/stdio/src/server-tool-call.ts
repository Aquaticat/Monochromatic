// Dispatches tools/call requests to registered tool handlers.

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import {
  JSON_RPC_INTERNAL_ERROR,
  JSON_RPC_INVALID_PARAMS,
  type JsonRpcOutbound,
  type JsonRpcRequest,
} from './json-rpc.ts';

import type { ToolCallResult, } from './protocol.ts';

import {
  respondError,
  respondSuccess,
} from './server-response.ts';
import type { RegisteredTool, } from './server-types.ts';

/**
 * Dispatches a `tools/call` request to the registered handler.
 * Validates tool name and arguments from untrusted client input before dispatch.
 *
 * @param toolMap - Immutable map of registered tools keyed by name.
 *
 * @param request - Request containing tool `name` and `arguments` in `params`.
 *
 * @returns Tool result wrapped in a JSON-RPC response via {@link respondSuccess}, or an error via {@link respondError} if the tool is unknown.
 *
 * @example
 * ```ts
 * const response = await handleToolCall({
 *   toolMap,
 *   request: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_diagnostics' } },
 * });
 * ```
 */
export async function handleToolCall(
  {
    toolMap,
    request,
  }: {
    readonly toolMap: ReadonlyMap<string, RegisteredTool>;
    readonly request: JsonRpcRequest;
  },
): Promise<JsonRpcOutbound> {
  /**
   * Echoed back in the response so the client can correlate the call with the result.
   */
  const {
    id,
    params,
  } = request;

  /**
   * Tool name extracted from untrusted params; `undefined` triggers an invalid-params error below.
   */
  const toolName = ((typeof params?.name) === 'string') ? params.name : undefined;
  if (toolName === undefined) {
    return respondError({
      id,
      code: JSON_RPC_INVALID_PARAMS,
      message: 'Missing or non-string tool name in tools/call',
    },);
  }

  /**
   * Raw `arguments` value from params, validated below before being handed to the tool.
   */
  const rawArgs = params?.arguments;
  /**
   * Validated argument bag: empty object when params arrived missing, null, an array, or a non-object.
   */
  const toolArgs: Record<string, unknown> = (rawArgs !== undefined)
      && (rawArgs !== null)
    && ((typeof rawArgs) === 'object')
    && (!Array.isArray(rawArgs,))
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed from unknown to non-array object above
    ? (rawArgs as Record<string, unknown>)
    : {};

  /**
   * Tool entry resolved from the registry; `undefined` means the client requested an unknown tool.
   */
  const registered = toolMap.get(toolName,);
  if (registered === undefined) {
    return respondError({
      id,
      code: JSON_RPC_INVALID_PARAMS,
      message: `Unknown tool: ${toolName}`,
    },);
  }

  // Deliberate catch-and-return: in a server context, tool handler errors must be
  // reported as JSON-RPC error responses rather than crashing the server process.
  try {
    /**
     * Tool handler output, wrapped below into a JSON-RPC success response.
     */
    const result: ToolCallResult = await registered.handler(toolArgs,);
    return respondSuccess({
      id,
      result,
    },);
  }
  catch (error: unknown) {
    /**
     * Human-readable error text; falls back to `String(error)` when the thrown value is not an `Error`.
     */
    const message = caughtValueText(error,);
    console.error(
      `[mcp-stdio] tool "${toolName}" threw:`,
      error,
    );
    return respondError({
      id,
      code: JSON_RPC_INTERNAL_ERROR,
      message: `Tool execution failed: ${message}`,
    },);
  }
}
