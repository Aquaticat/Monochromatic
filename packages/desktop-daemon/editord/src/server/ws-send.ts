/**
 * WebSocket send utility and peer type.
 *
 * Extracted from ws-dispatch to break the import cycle between
 * ws-dispatch, ws-dispatch-fs, and ws-dispatch-lsp.
 */

/** Peer type used throughout message dispatch. */
export type Peer = { send: (data: string,) => void; };

/**
 * Extracts a human-readable message from an unknown error value.
 *
 * @param error - caught error value
 *
 * @returns error message string
 *
 * @example
 * ```ts
 * const result = extractErrorMessage({ error: new Error('file not found'), });
 * // result === 'file not found'
 * ```
 */
export function extractErrorMessage({ error, }: { error: unknown; },): string {
  return error instanceof Error ? error.message : String(error,);
}

/**
 * Sends a JSON-serialized message to a WebSocket peer.
 *
 * @param peer - WebSocket peer to send to
 *
 * @param message - message object to serialize and send
 *
 * @example
 * ```ts
 * sendJson({ peer, message: { type: 'saved', id: 'req-1', path: '/src/main.ts' }, });
 * ```
 */
export function sendJson(
  {
    peer,
    message,
  }: {
    peer: Peer;
    message: Record<string, unknown>;
  },
): void {
  peer.send(JSON.stringify(message,),);
}
