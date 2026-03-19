/**
 * WebSocket handler for editord.
 *
 * Authenticates connections via token in the URL query string,
 * then dispatches incoming messages to the appropriate operation handler.
 */

import { defineWebSocketHandler, } from 'h3';
import type { EventHandler, } from 'h3';
import { listDir, } from './operations/list-dir.ts';
import { openFile, } from './operations/open.ts';
import { saveFile, } from './operations/save.ts';

/**
 * Incoming message from the client.
 * Each message has a `type` discriminant, a client-generated `id` for response correlation,
 * and type-specific fields.
 */
type ClientMessage =
  | { type: 'open'; id: string; path: string }
  | { type: 'save'; id: string; path: string; content: string }
  | { type: 'listDir'; id: string; path: string };

/**
 * Creates a WebSocket event handler that authenticates via token and dispatches operations.
 *
 * @param authToken - expected token value for connection authentication
 *
 * @param rootDir - root directory path to send to clients on connection
 *
 * @returns h3 event handler that upgrades to WebSocket
 */
export function createWsHandler(authToken: string, rootDir: string,): EventHandler {
  return defineWebSocketHandler(function resolveHooks(event,) {
    const url = new URL(event.url, 'http://localhost',);
    const token = url.searchParams.get('token',);

    if (token !== authToken) {
      return {
        open: function rejectUnauthenticated(peer,) {
          peer.send(JSON.stringify({ type: 'error', message: 'unauthorized', },),);
          peer.close();
        },
      };
    }

    return {
      open: function handleOpen(peer,) {
        console.log('[ws] peer connected',);
        peer.send(JSON.stringify({ type: 'connected', rootDir, },),);
      },

      async message(peer, message,) {
        let parsed: ClientMessage;
        try {
          parsed = JSON.parse(message.text(),) as ClientMessage;
        }
        catch {
          peer.send(JSON.stringify({ type: 'error', message: 'invalid JSON', },),);
          return;
        }

        try {
          if (parsed.type === 'open') {
            const result = await openFile(parsed.path,);
            peer.send(JSON.stringify({ type: 'fileContent', id: parsed.id, ...result, },),);
          }
          else if (parsed.type === 'save') {
            await saveFile(parsed.path, parsed.content,);
            peer.send(JSON.stringify({ type: 'saved', id: parsed.id, path: parsed.path, },),);
          }
          // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
          else if (parsed.type === 'listDir') {
            const result = await listDir(parsed.path,);
            peer.send(JSON.stringify({ type: 'dirListing', id: parsed.id, ...result, },),);
          }
          else {
            peer.send(JSON.stringify({
              type: 'error',
              id: (parsed as { id?: string }).id,
              message: `unknown message type: ${(parsed as { type: string }).type}`,
            },),);
          }
        }
        catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error,);
          peer.send(JSON.stringify({
            type: 'error',
            id: parsed.id,
            message: errorMessage,
          },),);
        }
      },

      close: function handleClose(_peer,) {
        console.log('[ws] peer disconnected',);
      },
    };
  },);
}
