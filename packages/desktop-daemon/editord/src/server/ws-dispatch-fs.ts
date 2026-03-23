/**
 * Filesystem action dispatch handlers for the WebSocket server.
 *
 * Handles deleteEntry, copyEntry, moveEntry, newEntry,
 * openInTerminal, and openInDefaultApp messages.
 */

import type { ClientMessage, } from '../protocol.ts';
import type { LspManager, } from './lsp/lsp-manager.ts';
import { assertWithinRoot, } from './operations/assert-within-root.ts';
import { copyEntry, } from './operations/copy-entry.ts';
import { deleteEntry, } from './operations/delete-entry.ts';
import { moveEntry, } from './operations/move-entry.ts';
import { newEntry, } from './operations/new-entry.ts';
import { openInDefaultApp, openInTerminal, } from './operations/open-external.ts';
import { sendJson, type Peer, } from './ws-send.ts';

/**
 * Checks whether an error is a Windows file-lock error (`EBUSY` or `EPERM`).
 *
 * @param error - caught error value
 *
 * @returns whether the error code indicates a file lock
 */
function isFileLockError(error: unknown,): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, } = error as { code?: string };
  return code === 'EBUSY' || code === 'EPERM';
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
 * @returns true if the message was handled, false if not an FS action type
 */
export async function dispatchFsMessage({ peer, parsed, rootDir, lspManager, }: {
  peer: Peer;
  parsed: ClientMessage;
  rootDir: string;
  lspManager: LspManager | null;
}): Promise<boolean> {
  if (parsed.type === 'deleteEntry') {
    try { await deleteEntry({ rootDir, path: parsed.path, },); }
    catch (error) {
      if (isFileLockError(error,) && lspManager !== null) { await lspManager.shutdownForPath({ path: parsed.path, },); await deleteEntry({ rootDir, path: parsed.path, },); }
      else { throw error; }
    }
    sendJson({ peer, message: { type: 'fsActionDone', id: parsed.id, }, },);
    return true;
  }
  if (parsed.type === 'copyEntry') {
    await copyEntry({ rootDir, path: parsed.path, destPath: parsed.destPath, },);
    sendJson({ peer, message: { type: 'fsActionDone', id: parsed.id, }, },);
    return true;
  }
  if (parsed.type === 'moveEntry') {
    try { await moveEntry({ rootDir, path: parsed.path, destPath: parsed.destPath, },); }
    catch (error) {
      if (isFileLockError(error,) && lspManager !== null) { await lspManager.shutdownForPath({ path: parsed.path, },); await moveEntry({ rootDir, path: parsed.path, destPath: parsed.destPath, },); }
      else { throw error; }
    }
    sendJson({ peer, message: { type: 'fsActionDone', id: parsed.id, }, },);
    return true;
  }
  if (parsed.type === 'newEntry') {
    await newEntry({ rootDir, parentPath: parsed.parentPath, name: parsed.name, isDirectory: parsed.isDirectory, },);
    sendJson({ peer, message: { type: 'fsActionDone', id: parsed.id, }, },);
    return true;
  }
  if (parsed.type === 'openInTerminal') {
    await openInTerminal({ rootDir, path: parsed.path, },);
    sendJson({ peer, message: { type: 'fsActionDone', id: parsed.id, }, },);
    return true;
  }
  if (parsed.type === 'openInDefaultApp') {
    await openInDefaultApp({ rootDir, path: parsed.path, },);
    sendJson({ peer, message: { type: 'fsActionDone', id: parsed.id, }, },);
    return true;
  }
  return false;
}
