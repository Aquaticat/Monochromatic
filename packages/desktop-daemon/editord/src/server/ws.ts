/**
 * WebSocket handler for editord.
 *
 * Authenticates connections via token in the URL query string,
 * then dispatches incoming messages to the appropriate operation handler.
 */

import {
  defineWebSocketHandler,
  type EventHandler,
} from 'h3';

import type { ClientMessage, } from '../protocol.ts';
import { l as rootLogger, tagged, } from './log.ts';
import { listDir, } from './operations/list-dir.ts';
import { openFile, } from './operations/open.ts';
import { saveFile, } from './operations/save.ts';

/** Tagged logger for the WebSocket subsystem. */
const l = tagged({ tag: 'ws', l: rootLogger, },);

/**
 * Rejects an unauthenticated peer by sending an error and closing.
 *
 * @param peer - WebSocket peer to reject
 */
function rejectUnauthenticated(peer: { send: (data: string) => void; close: () => void },): void {
  peer.send(JSON.stringify({ type: 'error', message: 'unauthorized', },),);
  peer.close();
}

/**
 * Parses and dispatches a single client message against the operation handlers.
 *
 * @param peer - WebSocket peer that sent the message
 *
 * @param messageText - raw message text from the WebSocket frame
 *
 * @param rootDir - root directory for path containment
 */
async function dispatchMessage(
  peer: { send: (data: string) => void },
  messageText: string,
  rootDir: string,
): Promise<void> {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; runtime type is validated by discriminant checks below
  const parsed = JSON.parse(messageText,) as ClientMessage;

  if (parsed.type === 'open') {
    const result = await openFile({ rootDir, path: parsed.path, },);
    peer.send(JSON.stringify({ type: 'fileContent', id: parsed.id, ...result, },),);
  }
  else if (parsed.type === 'save') {
    await saveFile({ rootDir, path: parsed.path, content: parsed.content, },);
    peer.send(JSON.stringify({ type: 'saved', id: parsed.id, path: parsed.path, },),);
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  else if (parsed.type === 'listDir') {
    const result = await listDir({ rootDir, path: parsed.path, },);
    peer.send(JSON.stringify({ type: 'dirListing', id: parsed.id, ...result, },),);
  }
  else {
    peer.send(JSON.stringify({
      type: 'error',
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- else branch: parsed is an unknown message shape from unvalidated JSON
      id: (parsed as { id?: string }).id,
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- else branch: parsed is an unknown message shape from unvalidated JSON
      message: `unknown message type: ${(parsed as { type: string }).type}`,
    },),);
  }
}

/**
 * Creates a WebSocket event handler that authenticates via token and dispatches operations.
 *
 * @param authToken - expected token value for connection authentication
 *
 * @param rootDir - root directory path for path containment and client greeting
 *
 * @returns h3 event handler that upgrades to WebSocket
 */
export function createWsHandler({ authToken, rootDir, }: { authToken: string; rootDir: string }): EventHandler {
  return defineWebSocketHandler(function resolveHooks(event,) {
    const url = new URL(event.url, 'http://localhost',);
    const token = url.searchParams.get('token',);

    if (token !== authToken) {
      return { open: rejectUnauthenticated, };
    }

    return {
      open: function handleOpen(peer,) {
        l.info('peer connected',);
        peer.send(JSON.stringify({ type: 'connected', rootDir, },),);
      },

      async message(peer, message,) {
        try {
          await dispatchMessage(peer, message.text(), rootDir,);
        }
        catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error,);
          l.error(`operation failed: ${errorMessage}`,);
          peer.send(JSON.stringify({
            type: 'error',
            message: errorMessage,
          },),);
        }
      },

      close: function handleClose(_peer,) {
        l.info('peer disconnected',);
      },
    };
  },);
}
