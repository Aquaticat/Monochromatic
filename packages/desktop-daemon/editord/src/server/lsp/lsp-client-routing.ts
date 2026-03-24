/**
 * JSON-RPC message routing for the LSP client.
 *
 * Routes incoming messages to pending request handlers or
 * forwards server notifications to the registered callback.
 */

import type { JsonRpcMessage, } from './json-rpc.ts';

/** Pending request awaiting an LSP server response. */
export type PendingLspRequest = {
  /** Resolves the pending request with the server's result. */
  resolve: (value: unknown,) => void;
  /** Rejects the pending request with an error. */
  reject: (error: Error,) => void;
};

/**
 * Routes an incoming JSON-RPC message to the appropriate handler.
 * Responses are matched to pending requests by ID.
 * Notifications are forwarded to the `onNotification` callback.
 * Server-initiated requests receive a no-op acknowledgment.
 *
 * @param message - parsed JSON-RPC message
 *
 * @param pending - map of pending requests keyed by JSON-RPC ID
 *
 * @param name - display name for error messages (e.g. "oxlint")
 *
 * @param send - writes a message to the child process stdin
 *
 * @param onNotification - callback for server-initiated notifications
 */
export function routeJsonRpcMessage({ message, pending, name, send, onNotification, }: {
  message: JsonRpcMessage;
  pending: Map<number, PendingLspRequest>;
  name: string;
  send: (message: unknown,) => void;
  onNotification: (event: { method: string; params: unknown; },) => void;
},): void {
  if ('id' in message && !('method' in message)) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- discriminant check above narrows to response shape
    const response = message as { id: number; result?: unknown;
      error?: { code: number; message: string; }; };
    const entry = pending.get(response.id,);
    if (entry !== undefined) {
      pending.delete(response.id,);
      if (response.error !== undefined)
        entry.reject(new Error(`${name}: ${response.error.message}`,),);
      else
        entry.resolve(response.result,);
    }
  }
  else if ('method' in message && !('id' in message)) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- discriminant check above narrows to notification shape
    const notification = message as { method: string; params?: unknown; };
    onNotification({ method: notification.method, params: notification.params, },);
  }
  else if ('method' in message && 'id' in message) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- discriminant check above narrows to request shape
    const request = message as { id: number; };
    send({ jsonrpc: '2.0', id: request.id, result: null, },);
  }
}
