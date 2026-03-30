// Dispatches tools/call requests to registered tool handlers.

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
 * @returns Tool result wrapped in a JSON-RPC response, or an error if the tool is unknown.
 */
export async function handleToolCall(
  toolMap: ReadonlyMap<string, RegisteredTool>,
  request: JsonRpcRequest,
): Promise<JsonRpcOutbound> {
  const {
    id,
    params,
  } = request;

  // Validate tool name is a string rather than blindly casting untrusted input.
  const toolName = typeof params?.name === 'string' ? params.name : undefined;
  if (toolName === undefined) {
    return respondError(
      id,
      JSON_RPC_INVALID_PARAMS,
      'Missing or non-string tool name in tools/call',
    );
  }

  // Validate arguments is a plain object when present, default to empty object otherwise.
  const rawArgs = params?.arguments;
  const toolArgs: Record<string, unknown> = rawArgs !== undefined
      && rawArgs !== null
      && typeof rawArgs === 'object'
      && !Array.isArray(rawArgs,)
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed from unknown to non-array object above
    ? (rawArgs as Record<string, unknown>)
    : {};

  const registered = toolMap.get(toolName,);
  if (registered === undefined) {
    return respondError(
      id,
      JSON_RPC_INVALID_PARAMS,
      `Unknown tool: ${toolName}`,
    );
  }

  // Deliberate catch-and-return: in a server context, tool handler errors must be
  // reported as JSON-RPC error responses rather than crashing the server process.
  try {
    const result: ToolCallResult = await registered.handler(toolArgs,);
    return respondSuccess(
      id,
      result,
    );
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error,);
    console.error(
      `[mcp-stdio] tool "${toolName}" threw:`,
      error,
    );
    return respondError(
      id,
      JSON_RPC_INTERNAL_ERROR,
      `Tool execution failed: ${message}`,
    );
  }
}
