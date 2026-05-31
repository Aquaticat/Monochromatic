/**
 * WebSocket handshake for the editord client.
 *
 * Waits for the initial server handshake message that confirms
 * authentication and provides the root directory path.
 */

import type { ServerMessage, } from '../../../protocol.ts';
import {
  l as rootLogger,
  tagged,
} from '../log.ts';

/**
 * Tagged logger for the WebSocket handshake.
 */
const l = tagged({
  tag: 'ws-handshake',
  l: rootLogger,
},);

/**
 * Maximum time to wait for the server's handshake message before rejecting (milliseconds).
 */
const HANDSHAKE_TIMEOUT_MS = 10_000;

/**
 * Performs the WebSocket handshake with the server.
 *
 * @param ws - WebSocket connection
 *
 * @param onConnected - callback with rootDir and fsId on success
 *
 * @example
 * ```ts
 * performHandshake({ ws: ws, onConnected: function handleConnected(event) { l.info(event); }, });
 * ```
 */
export function performHandshake({
  ws,
  onConnected,
}: {
  readonly ws: WebSocket;
  readonly onConnected: (data: {
    readonly rootDir: string;
    readonly fsId: string;
  },) => void;
},): Promise<void> {
  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- wrapping callback-based WebSocket events into a promise requires new Promise
  return new Promise<void>(function awaitConnection(
    resolve,
    reject,
  ) {
    /**
     * Handles the first WebSocket message, expecting a handshake confirmation.
     *
     * @param event - WebSocket message event containing the server handshake
     */
    function handleFirstMessage(event: MessageEvent,): void {
      clearTimeout(handshakeTimeoutId,);
      try {
        /**
         * Parsed server message; discriminated below on `data.type`.
         */
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; runtime type is validated by discriminant checks below
        const data = JSON.parse(String(event.data,),) as ServerMessage;
        if (data.type
          === 'connected') {
          onConnected({
            rootDir: data.rootDir,
            fsId: data.fsId,
          },);
          resolve();
        }
        else if (data.type
          === 'error') {
          reject(new Error(data.message,),);
        }
        else {
          reject(new Error(`unexpected handshake message: ${data.type}`,),);
        }
      }
      catch (error) {
        l.error(`invalid server handshake: ${String(error,)}`,);
        reject(new Error('invalid server handshake',),);
      }
    }

    /**
     * Timer that rejects the handshake if no message arrives within {@link HANDSHAKE_TIMEOUT_MS}.
     */
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types loaded
    const handshakeTimeoutId = globalThis.setTimeout(
      function rejectHandshakeTimeout(): void {
        l.error(`handshake timed out after ${HANDSHAKE_TIMEOUT_MS}ms`,);
        reject(new Error(`handshake timed out after ${HANDSHAKE_TIMEOUT_MS}ms`,),);
      },
      HANDSHAKE_TIMEOUT_MS,
    ) as unknown as number;

    ws.addEventListener(
      'message',
      handleFirstMessage,
      { once: true, },
    );
    ws.addEventListener(
      'error',
      function handleError() {
        l.error('WebSocket connection failed',);
        reject(new Error('WebSocket connection failed',),);
      },
      { once: true, },
    );
  },);
}
