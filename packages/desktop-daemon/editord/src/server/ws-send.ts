/**
 * WebSocket send utility and peer type.
 *
 * Extracted from ws-dispatch to break the import cycle between
 * ws-dispatch, ws-dispatch-fs, and ws-dispatch-lsp.
 */

/** Peer type used throughout message dispatch. */
export type Peer = { send: (data: string) => void };

/**
 * Sends a JSON-serialized message to a WebSocket peer.
 *
 * @param peer - WebSocket peer to send to
 *
 * @param message - message object to serialize and send
 */
export function sendJson({ peer, message, }: { peer: Peer; message: Record<string, unknown> }): void {
  peer.send(JSON.stringify(message,),);
}
