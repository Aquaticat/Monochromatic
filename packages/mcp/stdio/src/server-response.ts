// JSON-RPC response builders and notification handler.

import type {
  JsonRpcErrorResponse,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from './json-rpc.ts';

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
 * respondSuccess(1, { tools: [] });
 * // { jsonrpc: '2.0', id: 1, result: { tools: [] } }
 * ```
 */
export function respondSuccess(
  id: JsonRpcRequest['id'],
  result: unknown,
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
 * respondError(1, -32601, 'Method not found');
 * // { jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } }
 * ```
 */
export function respondError(
  id: JsonRpcRequest['id'],
  code: number,
  message: string,
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
 * @returns Always `undefined` since notifications produce no response.
 *
 * @example
 * ```ts
 * handleNotification({ jsonrpc: '2.0', method: 'notifications/initialized' });
 * // undefined
 * ```
 */
export function handleNotification(notification: JsonRpcNotification,): undefined {
  if (notification.method !== 'notifications/initialized')
    console.error(`[mcp-stdio] unexpected notification method: ${notification.method}`,);
  return undefined;
}
