/**
 * Feature-specific LSP dispatch handlers.
 *
 * Handles gotoDefinition, findReferences, selectionRange,
 * prepareRename, and rename messages.
 */

import type { ClientMessage, } from '../protocol.ts';
import type { LspManager, } from './lsp/lsp-manager.ts';
import { applyWorkspaceEdit, } from './operations/apply-workspace-edit.ts';
import type { DirWatcher, } from './operations/watch-filesystem.ts';
import { toWireSelectionRange, } from './ws-conversions.ts';
import {
  type Peer,
  replyEmpty,
  sendJson,
} from './ws-send.ts';

/**
 * Dispatches feature-specific LSP client messages.
 *
 * Handles navigation (gotoDefinition, findReferences, selectionRange)
 * and editing (prepareRename, rename) messages.
 *
 * @param peer - WebSocket peer that sent the message
 *
 * @param parsed - parsed client message
 *
 * @param lspManager - LSP server coordinator
 *
 * @param dirWatcher - watcher silenced during workspace-edit writes to avoid
 *   self-echoing `fileChanged` events back to the client
 *
 * @returns true if the message was handled, false if not a feature message type
 *
 * @example
 * ```ts
 * const handled = await dispatchLspFeatureMessage({
 *   peer,
 *   parsed: { type: 'gotoDefinition', id: '1', path: '/src/app.ts', line: 5, character: 12 },
 *   lspManager,
 *   dirWatcher,
 * });
 * ```
 */
export async function dispatchLspFeatureMessage(
  {
    peer,
    parsed,
    lspManager,
    dirWatcher,
  }: {
    readonly peer: Peer;
    readonly parsed: ClientMessage;
    readonly lspManager: LspManager | null;
    readonly dirWatcher: DirWatcher | null;
  },
): Promise<boolean> {
  if (parsed.type
    === 'gotoDefinition') {
    if (lspManager === null) {
      return replyEmpty({
        peer,
        message: {
          type: 'definitionResult',
          id: parsed.id,
          path: '',
          line: 0,
          character: 0,
        },
      },);
    }
    /**
     * Definition target reported by the LSP, or null when no symbol resolves at the position.
     */
    const def = await lspManager.gotoDefinition({
      path: parsed.path,
      line: parsed.line,
      character: parsed.character,
    },);
    if (def === null) {
      sendJson({
        peer,
        message: {
          type: 'definitionResult',
          id: parsed.id,
          path: '',
          line: 0,
          character: 0,
        },
      },);
      return true;
    }
    sendJson({
      peer,
      message: {
        type: 'definitionResult',
        id: parsed.id,
        path: def.path,
        line: def.line,
        character: def.character,
      },
    },);
    return true;
  }
  if (parsed.type
    === 'findReferences') {
    if (lspManager === null) {
      return replyEmpty({
        peer,
        message: {
          type: 'referencesResult',
          id: parsed.id,
          locations: [],
        },
      },);
    }
    /**
     * Reference sites returned to the requesting peer.
     */
    const locations = await lspManager.references({
      path: parsed.path,
      line: parsed.line,
      character: parsed.character,
    },);
    sendJson({
      peer,
      message: {
        type: 'referencesResult',
        id: parsed.id,
        locations,
      },
    },);
    return true;
  }
  if (parsed.type
    === 'selectionRange') {
    if (lspManager === null) {
      return replyEmpty({
        peer,
        message: {
          type: 'selectionRangeResult',
          id: parsed.id,
          ranges: [],
        },
      },);
    }
    /**
     * Server-shape ranges converted to wire shape on the next line.
     */
    const lspRanges = await lspManager.selectionRange({
      path: parsed.path,
      positions: parsed.positions,
    },);
    /**
     * Wire-shape ranges sent to the client.
     */
    const ranges = lspRanges.map(function convertRange(r,) {
      return toWireSelectionRange({ lspRange: r, },);
    },);
    sendJson({
      peer,
      message: {
        type: 'selectionRangeResult',
        id: parsed.id,
        ranges,
      },
    },);
    return true;
  }
  if (parsed.type
    === 'prepareRename') {
    if (lspManager === null) {
      return replyEmpty({
        peer,
        message: {
          type: 'prepareRenameResult',
          id: parsed.id,
          canRename: false,
        },
      },);
    }
    /**
     * Eligibility / placeholder; null means the symbol is not renamable.
     */
    const result = await lspManager.prepareRename({
      path: parsed.path,
      line: parsed.line,
      character: parsed.character,
    },);
    if (result === null) {
      sendJson({
        peer,
        message: {
          type: 'prepareRenameResult',
          id: parsed.id,
          canRename: false,
        },
      },);
      return true;
    }
    sendJson({
      peer,
      message: {
        type: 'prepareRenameResult',
        id: parsed.id,
        canRename: true,
        range: result.range,
        placeholder: result.placeholder,
      },
    },);
    return true;
  }
  if (parsed.type
    === 'rename') {
    if (lspManager === null) {
      return replyEmpty({
        peer,
        message: {
          type: 'renameResult',
          id: parsed.id,
          edits: [],
        },
      },);
    }
    /**
     * WorkspaceEdit shape from LSP; null means rename produced no edits.
     */
    const workspaceEdit = await lspManager.rename({
      path: parsed.path,
      line: parsed.line,
      character: parsed.character,
      newName: parsed.newName,
    },);
    if (workspaceEdit === null) {
      sendJson({
        peer,
        message: {
          type: 'renameResult',
          id: parsed.id,
          edits: [],
        },
      },);
      return true;
    }
    /**
     * Per-file edit groups returned to the client for display and confirmation.
     */
    const fileEdits = await applyWorkspaceEdit({
      workspaceEdit,
      currentFilePath: parsed.path,
      dirWatcher,
    },);
    sendJson({
      peer,
      message: {
        type: 'renameResult',
        id: parsed.id,
        edits: fileEdits,
      },
    },);
    return true;
  }
  return false;
}
