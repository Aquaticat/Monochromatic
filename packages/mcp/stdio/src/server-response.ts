// JSON-RPC response builders and notification handler.

import type {
  JsonRpcErrorResponse,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from './json-rpc.ts';

import {
  type DispatchResult,
  NO_RESPONSE,
} from './server-types.ts';

/**
 * Constructs a JSON-RPC success response.
 *
 * @param id - Request id to echo back.
 *
 * @param result - Payload for the `result` field.
 *
 * @returns Formatted JSON-RPC response.
 *
 * @example
 * ```ts
 * respondSuccess({ id: 1, result: { tools: [] } });
 * // { jsonrpc: '2.0', id: 1, result: { tools: [] } }
 * ```
 */
export function respondSuccess(
  {
    id,
    result,
  }: {
    readonly id: JsonRpcRequest['id'];
    readonly result: unknown;
  },
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Constructs a JSON-RPC error response.
 *
 * @param id - Request id to echo back.
 *
 * @param code - Standard JSON-RPC error code.
 *
 * @param message - Human-readable error description.
 *
 * @returns Formatted JSON-RPC error response.
 *
 * @example
 * ```ts
 * respondError({ id: 1, code: -32601, message: 'Method not found' });
 * // { jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } }
 * ```
 */
export function respondError(
  {
    id,
    code,
    message,
  }: {
    readonly id: JsonRpcRequest['id'];
    readonly code: number;
    readonly message: string;
  },
): JsonRpcErrorResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  };
}

/**
 * Processes notifications. Logs unexpected notification methods for protocol debugging.
 *
 * @param notification - Inbound notification (consumed but not acted upon).
 *
 * @returns {@link NO_RESPONSE} sentinel since notifications produce no reply to send.
 *
 * @example
 * ```ts
 * handleNotification({ jsonrpc: '2.0', method: 'notifications/initialized' });
 * // NO_RESPONSE
 * ```
 */
export function handleNotification(notification: JsonRpcNotification,): DispatchResult {
  if (notification.method
    !== 'notifications/initialized')
    console.error(`[mcp-stdio] unexpected notification method: ${notification.method}`,);
  return NO_RESPONSE;
}
