/**
 * WebSocket handshake for the editord client.
 *
 * Waits for the initial server handshake message that confirms
 * authentication and provides the root directory path.
 */

import type { ServerMessage, } from '../../../protocol.ts';
import { l as rootLogger, tagged, } from '../log.ts';

/** Tagged logger for the WebSocket handshake. */
const l = tagged({ tag: 'ws-handshake', l: rootLogger, },);

/**
 * Performs the WebSocket handshake with the server.
 *
 * @param ws - WebSocket connection
 *
 * @param onConnected - callback with rootDir and fsId on success
 */
export function performHandshake({ ws, onConnected, }: {
  ws: WebSocket;
  onConnected: (data: { rootDir: string; fsId: string },) => void;
}): Promise<void> {
  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- wrapping callback-based WebSocket events into a promise requires new Promise
  return new Promise<void>(function awaitConnection(resolve, reject,) {
    /**
     * Handles the first WebSocket message, expecting a handshake confirmation.
     *
     * @param event - WebSocket message event containing the server handshake
     */
    function handleFirstMessage(event: MessageEvent,): void {
      try {
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; runtime type is validated by discriminant checks below
        const data = JSON.parse(String(event.data,),) as ServerMessage;
        if (data.type === 'connected') {
          onConnected({ rootDir: data.rootDir, fsId: data.fsId, },);
          resolve();
        }
        else if (data.type === 'error') {
          reject(new Error(data.message,),);
        }
      }
      catch (error) {
        l.error(`invalid server handshake: ${String(error,)}`,);
        reject(new Error('invalid server handshake',),);
      }
    }

    ws.addEventListener('message', handleFirstMessage, { once: true, },);
    ws.addEventListener('error', function handleError() {
      l.error('WebSocket connection failed',);
      reject(new Error('WebSocket connection failed',),);
    }, { once: true, },);
  },);
}
