/**
 * WebSocket send utility and peer type.
 *
 * Extracted from ws-dispatch to break the import cycle between
 * ws-dispatch, ws-dispatch-fs, and ws-dispatch-lsp.
 */

/**
 * Peer type used throughout message dispatch.
 */
export type Peer = { readonly send: (data: string,) => void; };

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
export function extractErrorMessage({ error, }: { readonly error: unknown; },): string {
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
    readonly peer: Peer;
    readonly message: Readonly<Record<string, unknown>>;
  },
): void {
  peer.send(JSON.stringify(message,),);
}

/**
 * Sends an empty result when no LSP manager is available.
 * Avoids repeating the null-check + empty-response pattern for each feature.
 *
 * @param peer - WebSocket peer to reply to
 *
 * @param message - pre-built empty result message
 *
 * @returns always true (message handled)
 *
 * @example
 * ```ts
 * return replyEmpty({ peer, message: { type: 'hoverResult', id: '1', contents: '' }, });
 * ```
 */
export function replyEmpty(
  {
    peer,
    message,
  }: {
    readonly peer: Peer;
    readonly message: Readonly<Record<string, unknown>>;
  },
): true {
  sendJson({
    peer,
    message,
  },);
  return true;
}
