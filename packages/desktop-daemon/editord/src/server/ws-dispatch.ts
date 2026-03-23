/**
 * WebSocket message dispatch for editord.
 *
 * Parses incoming client messages and routes them to the appropriate
 * sub-dispatcher for core, LSP, or filesystem operations.
 */

import type { ClientMessage, } from '../protocol.ts';
import { l as rootLogger, tagged, } from './log.ts';
import type { LspManager, } from './lsp/lsp-manager.ts';
import { assertWithinRoot, } from './operations/assert-within-root.ts';
import { listDir, } from './operations/list-dir.ts';
import { openFile, } from './operations/open.ts';
import { saveFile, } from './operations/save.ts';
import { search, } from './operations/search.ts';
import type { DirWatcher, } from './operations/watch-filesystem.ts';
import { dispatchFsMessage, } from './ws-dispatch-fs.ts';
import { dispatchLspMessage, } from './ws-dispatch-lsp.ts';
import { sendJson, type Peer, } from './ws-send.ts';

export { sendJson, type Peer, };

/** Tagged logger for the dispatch subsystem. */
const l = tagged({ tag: 'ws-dispatch', l: rootLogger, },);

/**
 * Tracks the `AbortController` for the currently in-flight search per peer.
 * When a new search arrives, the previous one is aborted so its `rg` processes are killed.
 */
export const peerSearchControllers = new WeakMap<object, AbortController>();

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
 */
export async function dispatchMessage({ peer, messageText, rootDir, lspManager, dirWatcher, }: {
  peer: Peer;
  messageText: string;
  rootDir: string;
  lspManager: LspManager | null;
  dirWatcher: DirWatcher | null;
}): Promise<void> {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; runtime type is validated by discriminant checks below
  const parsed = JSON.parse(messageText,) as ClientMessage;

  if (parsed.type === 'open') {
    const result = await openFile({ rootDir, path: parsed.path, },);
    sendJson({ peer, message: { type: 'fileContent', id: parsed.id, ...result, }, },);
    if (lspManager !== null && result.kind === 'text') await lspManager.didOpen({ path: parsed.path, text: result.content, },);
    return;
  }
  if (parsed.type === 'save') {
    const absolutePath = assertWithinRoot({ rootDir, path: parsed.path, },);
    await saveFile({ rootDir, path: parsed.path, content: parsed.content, },);
    if (dirWatcher !== null) dirWatcher.suppressPath({ path: absolutePath, },);
    sendJson({ peer, message: { type: 'saved', id: parsed.id, path: parsed.path, }, },);
    if (lspManager !== null) await lspManager.didSave({ path: parsed.path, },);
    return;
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  if (parsed.type === 'listDir') {
    const result = await listDir({ rootDir, path: parsed.path, },);
    sendJson({ peer, message: { type: 'dirListing', id: parsed.id, ...result, }, },);
    return;
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  if (parsed.type === 'search') {
    peerSearchControllers.get(peer,)?.abort();
    const controller = new AbortController();
    peerSearchControllers.set(peer, controller,);
    assertWithinRoot({ rootDir, path: parsed.scope, },);
    const result = await search({ rootDir: parsed.scope, query: parsed.query, signal: controller.signal, },);
    if (!controller.signal.aborted) sendJson({ peer, message: { type: 'searchResults', id: parsed.id, ...result, }, },);
    return;
  }

  if (await dispatchLspMessage({ peer, parsed, rootDir, lspManager, dirWatcher, },)) return;
  if (await dispatchFsMessage({ peer, parsed, rootDir, lspManager, },)) return;

  l.error(`unknown message type: ${(parsed as { type: string }).type}`,);
  sendJson({ peer, message: {
    type: 'error',
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- else branch: parsed is an unknown message shape from unvalidated JSON
    id: (parsed as { id?: string }).id,
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- else branch: parsed is an unknown message shape from unvalidated JSON
    message: `unknown message type: ${(parsed as { type: string }).type}`,
  }, },);
}
