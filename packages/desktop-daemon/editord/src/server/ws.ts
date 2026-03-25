/**
 * WebSocket handler for editord.
 *
 * Authenticates connections via token in the URL query string,
 * then dispatches incoming messages to the appropriate operation handler.
 * Integrates with the LSP manager for language intelligence features.
 */

import {
  defineWebSocketHandler,
  type EventHandler,
} from 'h3';

import {
  l as rootLogger,
  tagged,
} from './log.ts';
import type { LspManager, } from './lsp/lsp-manager.ts';
import type { DirWatcher, } from './operations/watch-filesystem.ts';
import {
  dispatchMessage,
  peerSearchControllers,
} from './ws-dispatch.ts';
import {
  type Peer,
  sendJson,
} from './ws-send.ts';

/** Tagged logger for the WebSocket subsystem. */
const l = tagged({
  tag: 'ws',
  l: rootLogger,
},);

/**
 * Rejects an unauthenticated peer by sending an error and closing.
 *
 * @param peer - WebSocket peer to reject
 */
function rejectUnauthenticated(
  peer: {
    send: (data: string,) => void;
    close: () => void
  },
): void {
  sendJson({
    peer,
    message: {
      type: 'error',
      message: 'unauthorized',
    },
  },);
  peer.close();
}

/**
 * Creates a WebSocket event handler that authenticates via token and dispatches operations.
 *
 * @param authToken - expected token value for connection authentication
 *
 * @param rootDir - root directory path for path containment and client greeting
 *
 * @param fsId - stable filesystem identifier for the volume containing rootDir
 *
 * @param lspManager - LSP server coordinator, or null if LSP is disabled
 *
 * @param connectedPeers - set of currently connected peers for broadcast
 *
 * @param dirWatcher - filesystem watcher for directory change events
 *
 * @returns h3 event handler that upgrades to WebSocket
 */
export function createWsHandler(
  {
    authToken,
    rootDir,
    fsId,
    lspManager,
    connectedPeers,
    dirWatcher,
  }: {
    authToken: string;
    rootDir: string;
    fsId: string;
    lspManager: LspManager | null;
    connectedPeers: Set<{ send: (data: string,) => void; }>;
    dirWatcher: DirWatcher | null;
  },
): EventHandler {
  return defineWebSocketHandler(function resolveHooks(event,) {
    const url = new URL(
      event.url,
      'http://localhost',
    );
    const token = url.searchParams.get('token',);

    if (token !== authToken)
      return { open: rejectUnauthenticated, };

    return {
      open: function handleOpen(peer,) {
        l.info('peer connected',);
        connectedPeers.add(peer,);
        sendJson({
          peer,
          message: {
            type: 'connected',
            rootDir,
            fsId,
          },
        },);
      },

      async message(
        peer,
        message,
      ) {
        try {
          await dispatchMessage({
            peer,
            messageText: message.text(),
            rootDir,
            lspManager,
            dirWatcher,
          },);
        }
        catch (error) {
          // Only reached for pre-parse errors (malformed JSON) where no request id exists.
          // Handler-level errors are caught inside dispatchMessage with proper id correlation.
          const errorMessage = error instanceof Error ? error.message : String(error,);
          l.error(`message handler failed: ${errorMessage}`,);
          sendJson({
            peer,
            message: {
              type: 'error',
              message: errorMessage,
            },
          },);
        }
      },

      close: function handleClose(peer,) {
        peerSearchControllers.delete(peer,);
        connectedPeers.delete(peer,);
        l.info('peer disconnected',);
      },
    };
  },);
}
