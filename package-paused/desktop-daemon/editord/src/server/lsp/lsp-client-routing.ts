/**
 * JSON-RPC message routing for the LSP client.
 *
 * Routes incoming messages to pending request handlers or
 * forwards server notifications to the registered callback.
 */

import type { JsonRpcMessage, } from './json-rpc.ts';

/**
 * Pending request awaiting an LSP server response.
 */
export type PendingLspRequest = {
  /**
   * Resolves the pending request with the server's result.
   */
  readonly resolve: (value: unknown,) => void;
  /**
   * Rejects the pending request with an error.
   */
  readonly reject: (error: Error,) => void;
  /**
   * Timeout handle to clear when the response arrives.
   */
  timeoutId: ReturnType<typeof setTimeout> | null;
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
 *
 * @example
 * ```ts
 * routeJsonRpcMessage({
 *   message: { id: 1, result: { contents: 'hover text' } },
 *   pending,
 *   name: 'tsc',
 *   send: function writeTo(msg) { child.stdin.write(JSON.stringify(msg)); },
 *   onNotification: function handleNotif({ method, params }) { l.info(method); },
 * });
 * ```
 */
export function routeJsonRpcMessage({
  message,
  pending,
  name,
  send,
  onNotification,
}: {
  readonly message: JsonRpcMessage;
  readonly pending: Map<number, PendingLspRequest>;
  readonly name: string;
  readonly send: (message: unknown,) => void;
  readonly onNotification: (event: {
    readonly method: string;
    readonly params: unknown;
  },) => void;
},): void {
  if (('id' in message) && (!('method' in message))) {
    /**
     * Narrowed response view used to look up the matching pending request.
     */
    const response = message as {
      readonly id: number;
      readonly result?: unknown;
      readonly error?: {
        readonly code: number;
        readonly message: string;
      };
    };
    /**
     * Pending request entry; undefined means the response was orphaned (e.g. timed out).
     */
    const entry = pending.get(response.id,);
    if (entry !== undefined) {
      pending.delete(response.id,);
      if (entry.timeoutId
        !== null)
        clearTimeout(entry.timeoutId,);
      if (response.error
        !== undefined)
        entry.reject(new Error(`${name}: ${response.error
          .message}`,),);
      else
        entry.resolve(response.result,);
    }
  }
  else if (('method' in message) && (!('id' in message))) {
    /**
     * Narrowed notification view forwarded to the consumer's handler.
     */
    const notification = message as {
      readonly method: string;
      readonly params?: unknown;
    };
    onNotification({
      method: notification.method,
      params: notification.params,
    },);
  }
  else if (('method' in message) && ('id' in message)) {
    /**
     * Narrowed request view used only for the response id below.
     */
    const request = message as { readonly id: number; };
    send({
      jsonrpc: '2.0',
      id: request.id,
      result: null,
    },);
  }
}
