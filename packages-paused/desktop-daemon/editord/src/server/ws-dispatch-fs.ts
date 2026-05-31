/**
 * Filesystem action dispatch handlers for the WebSocket server.
 *
 * Handles deleteEntry, copyEntry, moveEntry, newEntry,
 * openInTerminal, and openInDefaultApp messages.
 */

import type { ClientMessage, } from '../protocol.ts';
import type { LspManager, } from './lsp/lsp-manager.ts';
import { copyEntry, } from './operations/copy-entry.ts';
import { deleteEntry, } from './operations/delete-entry.ts';
import { moveEntry, } from './operations/move-entry.ts';
import { newEntry, } from './operations/new-entry.ts';
import {
  openInDefaultApp,
  openInTerminal,
} from './operations/open-external.ts';
import type { DirWatcher, } from './operations/watch-filesystem.ts';
import {
  type Peer,
  sendJson,
} from './ws-send.ts';

/**
 * Checks whether an error is a Windows file-lock error (`EBUSY` or `EPERM`).
 *
 * @param error - caught error value
 *
 * @returns whether the error code indicates a file lock
 */
function isFileLockError(error: unknown,): boolean {
  if (((typeof error) !== 'object') || (error === null))
    return false;
  /**
   * Node `errno` code lifted off the caught error so the lock-error check stays local.
   */
  const { code, } = error as { readonly code?: string; };
  return (code === 'EBUSY') || (code === 'EPERM');
}

/**
 * Runs an async operation, retrying once after shutting down the LSP server
 * for the given path if a file-lock error (`EBUSY`/`EPERM`) is encountered.
 *
 * Generic over the operation's return type so callers (move, delete) can
 * surface the resolved absolute paths needed for watcher suppression.
 *
 * @param operation - async operation to attempt
 *
 * @param path - file path to pass to `lspManager.shutdownForPath` on retry
 *
 * @param lspManager - LSP server coordinator; retry is skipped when null
 *
 * @returns whatever the operation resolves with
 *
 * @throws re-throws non-file-lock errors and file-lock errors when lspManager is null
 */
async function retryOnFileLock<T,>({
  operation,
  path,
  lspManager,
}: {
  readonly operation: () => Promise<T>;
  readonly path: string;
  readonly lspManager: LspManager | null;
},): Promise<T> {
  try {
    return await operation();
  }
  catch (error) {
    if (isFileLockError(error,)
      && (lspManager !== null)) {
      await lspManager.shutdownForPath({ path, },);
      return await operation();
    }
    throw error;
  }
}

/**
 * Sends a `fsActionDone` acknowledgment to the peer.
 *
 * @param peer - WebSocket peer to notify
 *
 * @param id - request ID to correlate
 */
function sendFsActionDone({
  peer,
  id,
}: {
  readonly peer: Peer;
  readonly id: string;
},): void {
  sendJson({
    peer,
    message: {
      type: 'fsActionDone',
      id,
    },
  },);
}

/**
 * Dispatches filesystem action messages to the appropriate handler.
 *
 * @param peer - WebSocket peer that sent the message
 *
 * @param parsed - parsed client message
 *
 * @param rootDir - root directory for path containment
 *
 * @param lspManager - LSP server coordinator for file lock retry
 *
 * @param dirWatcher - watcher silenced for the paths each operation touches,
 *   so the client never sees `fileChanged` echoes from its own fs action
 *
 * @returns true if the message was handled, false if not an FS action type
 *
 * @example
 * ```ts
 * const handled = await dispatchFsMessage({ peer, parsed: { type: 'fsAction', id: '1', action: 'newFile', path: 'src', name: 'utils.ts' }, rootDir: '/home/user/project', lspManager, dirWatcher, });
 * ```
 */
export async function dispatchFsMessage({
  peer,
  parsed,
  rootDir,
  lspManager,
  dirWatcher,
}: {
  readonly peer: Peer;
  readonly parsed: ClientMessage;
  readonly rootDir: string;
  readonly lspManager: LspManager | null;
  readonly dirWatcher: DirWatcher | null;
},): Promise<boolean> {
  if (parsed.type
    === 'deleteEntry') {
    /**
     * Resolved absolute path of the deleted entry; required to suppress watcher echoes.
     */
    const absolutePath = await retryOnFileLock({
      operation: function del() {
        return deleteEntry({
          rootDir,
          path: parsed.path,
        },);
      },
      path: parsed.path,
      lspManager,
    },);
    if (dirWatcher !== null)
      dirWatcher.suppressPath({ path: absolutePath, },);
    sendFsActionDone({
      peer,
      id: parsed.id,
    },);
    return true;
  }
  if (parsed.type
    === 'copyEntry') {
    /**
     * Resolved absolute destination path; required to suppress watcher echoes for the new entry.
     */
    const absoluteDest = await copyEntry({
      rootDir,
      path: parsed.path,
      destPath: parsed.destPath,
    },);
    if (dirWatcher !== null)
      dirWatcher.suppressPath({ path: absoluteDest, },);
    sendFsActionDone({
      peer,
      id: parsed.id,
    },);
    return true;
  }
  if (parsed.type
    === 'moveEntry') {
    /**
     * Resolved source and destination paths from the move; both feed into watcher suppression.
     */
    const {
      source,
      dest,
    } = await retryOnFileLock({
      operation: function mv() {
        return moveEntry({
          rootDir,
          path: parsed.path,
          destPath: parsed.destPath,
        },);
      },
      path: parsed.path,
      lspManager,
    },);
    if (dirWatcher !== null) {
      dirWatcher.suppressPath({ path: source, },);
      dirWatcher.suppressPath({ path: dest, },);
    }
    sendFsActionDone({
      peer,
      id: parsed.id,
    },);
    return true;
  }
  if (parsed.type
    === 'newEntry') {
    /**
     * Resolved absolute path of the new entry; needed to suppress watcher echoes for the creation.
     */
    const absolutePath = await newEntry({
      rootDir,
      parentPath: parsed.parentPath,
      name: parsed.name,
      isDirectory: parsed.isDirectory,
    },);
    if (dirWatcher !== null)
      dirWatcher.suppressPath({ path: absolutePath, },);
    sendFsActionDone({
      peer,
      id: parsed.id,
    },);
    return true;
  }
  if (parsed.type
    === 'openInTerminal') {
    await openInTerminal({
      rootDir,
      path: parsed.path,
    },);
    sendFsActionDone({
      peer,
      id: parsed.id,
    },);
    return true;
  }
  if (parsed.type
    === 'openInDefaultApp') {
    await openInDefaultApp({
      rootDir,
      path: parsed.path,
    },);
    sendFsActionDone({
      peer,
      id: parsed.id,
    },);
    return true;
  }
  return false;
}
