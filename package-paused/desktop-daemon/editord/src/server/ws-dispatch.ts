/**
 * WebSocket message dispatch for editord.
 *
 * Parses incoming client messages and routes them to the appropriate
 * sub-dispatcher for core, LSP, or filesystem operations.
 */

import type { ClientMessage, } from '../protocol.ts';
import {
  l as rootLogger,
  tagged,
} from './log.ts';
import type { LspManager, } from './lsp/lsp-manager.ts';
import { assertWithinRoot, } from './operations/assert-within-root.ts';
import { listDir, } from './operations/list-dir.ts';
import { openFile, } from './operations/open.ts';
import { saveFile, } from './operations/save.ts';
import { search, } from './operations/search.ts';
import type { DirWatcher, } from './operations/watch-filesystem.ts';
import { dispatchFsMessage, } from './ws-dispatch-fs.ts';
import { dispatchLspMessage, } from './ws-dispatch-lsp.ts';
import {
  extractErrorMessage,
  type Peer,
  sendJson,
} from './ws-send.ts';

/**
 * Tagged logger for the dispatch subsystem.
 */
const l = tagged({
  tag: 'ws-dispatch',
  l: rootLogger,
},);

/**
 * Tracks the `AbortController` for the currently in-flight search per peer.
 * When a new search arrives, the previous one is aborted so its `rg` processes are killed.
 */
export const peerSearchControllers: WeakMap<object, AbortController> = new WeakMap<object, AbortController>();

/**
 * Parses and dispatches a single client message against the operation handlers.
 *
 * @param peer - WebSocket peer that sent the message
 *
 * @param messageText - raw message text from the WebSocket frame
 *
 * @param rootDir - root directory for path containment
 *
 * @param lspManager - LSP server coordinator
 *
 * @param dirWatcher - filesystem watcher for save suppression and dir registration
 *
 * @example
 * ```ts
 * await dispatchMessage({ peer, messageText: '{"type":"open","id":"1","path":"src/app.ts"}', rootDir: '/home/user/project', lspManager, dirWatcher, });
 * ```
 */
export async function dispatchMessage(
  {
    peer,
    messageText,
    rootDir,
    lspManager,
    dirWatcher,
  }: {
    readonly peer: Peer;
    readonly messageText: string;
    readonly rootDir: string;
    readonly lspManager: LspManager | null;
    readonly dirWatcher: DirWatcher | null;
  },
): Promise<void> {
  /**
   * Untyped intermediate so the shape can be validated before assertion.
   */
  const raw: unknown = JSON.parse(messageText,);
  if (((typeof raw) !== 'object')
    || (raw === null)
    || (!('type' in raw))
    || ((typeof (raw as { readonly type: unknown; }).type) !== 'string'))
  {
    sendJson({
      peer,
      message: {
        type: 'error',
        message: 'invalid message: missing or non-string "type" field',
      },
    },);
    return;
  }
  /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- shape validated above: object with string `type`; individual handlers check discriminants */
  /**
   * Narrowed view used by every handler branch below.
   */
  const parsed = raw as ClientMessage;
  /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */

  try {
    if (parsed.type
      === 'open') {
      /**
       * File contents and metadata returned to the requesting peer.
       */
      const result = await openFile({
        rootDir,
        path: parsed.path,
      },);
      sendJson({
        peer,
        message: {
          type: 'fileContent',
          id: parsed.id,
          ...result,
        },
      },);
      if ((lspManager !== null) && (result.kind
        === 'text')) {
        await lspManager.didOpen({
          path: parsed.path,
          text: result.content,
          size: result.size
            ?? 0,
        },);
      }
      return;
    }
    if (parsed.type
      === 'save') {
      /**
       * Resolved path used to suppress the matching watcher event below.
       */
      const absolutePath = await saveFile({
        rootDir,
        path: parsed.path,
        content: parsed.content,
      },);
      if (dirWatcher !== null)
        dirWatcher.suppressPath({ path: absolutePath, },);
      sendJson({
        peer,
        message: {
          type: 'saved',
          id: parsed.id,
          path: parsed.path,
        },
      },);
      if (lspManager !== null)
        await lspManager.didSave({ path: parsed.path, },);
      return;
    }
    if (parsed.type
      === 'listDir') {
      /**
       * Directory entries and metadata returned to the requesting peer.
       */
      const result = await listDir({
        rootDir,
        path: parsed.path,
      },);
      sendJson({
        peer,
        message: {
          type: 'dirListing',
          id: parsed.id,
          ...result,
        },
      },);
      return;
    }
    if (parsed.type
      === 'search') {
      peerSearchControllers.get(peer,)
        ?.abort();
      /**
       * Stored on the peer so a subsequent search request can cancel this one.
       */
      const controller = new AbortController();
      peerSearchControllers.set(
        peer,
        controller,
      );
      assertWithinRoot({
        rootDir,
        path: parsed.scope,
      },);
      /**
       * Search hits returned only when the controller has not been aborted.
       */
      const result = await search({
        rootDir: parsed.scope,
        query: parsed.query,
        signal: controller.signal,
      },);
      if (!controller.signal
        .aborted) {
        sendJson({
          peer,
          message: {
            type: 'searchResults',
            id: parsed.id,
            ...result,
          },
        },);
      }
      return;
    }

    if (await dispatchLspMessage({
      peer,
      parsed,
      rootDir,
      lspManager,
      dirWatcher,
    },)) {
      return;
    }
    if (await dispatchFsMessage({
      peer,
      parsed,
      rootDir,
      lspManager,
      dirWatcher,
    },)) {
      return;
    }

    l.error(`unknown message type: ${(parsed as { readonly type: string; }).type}`,);
    sendJson({
      peer,
      message: {
        type: 'error',
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- else branch: parsed is an unknown message shape from unvalidated JSON
        id: (parsed as { readonly id?: string; }).id,
        message: `unknown message type: ${(parsed as { readonly type: string; }).type}`,
      },
    },);
  }
  catch (error) {
    /**
     * Normalised to a string so the error reply is JSON-safe.
     */
    const msg = extractErrorMessage({ error, },);
    /**
     * Filesystem race-condition class: target vanished or changed type between the
     * client request and the server syscall. Most frequent source is the file-tree's
     * speculative subdirectory prefetch racing transient lock directories created
     * by `proper-lockfile` (e.g. `~/.claude.json.lock`), which exist only between
     * `mkdir` and `rmdir` calls. Logged at `warn` rather than `error` so the
     * legitimate-error signal is not drowned by expected races.
     */
    const code: unknown
      = ((typeof error) === 'object') && (error !== null)
        && ('code' in error)
        ? error.code
        : undefined;
    if ((code === 'ENOENT') || (code === 'ENOTDIR'))
      l.warn(`dispatch failed (transient race): ${msg}`,);
    else
      l.error(`dispatch failed: ${msg}`,);
    /**
     * Undefined for notifications, suppressing the targeted reply below.
     */
    const requestId = 'id' in parsed ? (parsed as { readonly id: string; }).id : undefined;
    if (requestId !== undefined) {
      sendJson({
        peer,
        message: {
          type: 'error',
          id: requestId,
          message: msg,
        },
      },);
    }
  }
}
