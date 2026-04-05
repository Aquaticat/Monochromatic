/**
 * LSP message dispatch handlers for the WebSocket server.
 *
 * Handles hover, completion, format, gotoDefinition, findReferences,
 * selectionRange, inlayHint, prepareRename, rename, didChange, didClose,
 * and watchDir messages.
 */

import type {
  ClientMessage,
  TextEdit,
} from '../protocol.ts';
import type { LspManager, } from './lsp/lsp-manager.ts';
import { applyWorkspaceEdit, } from './operations/apply-workspace-edit.ts';
import { assertWithinRoot, } from './operations/assert-within-root.ts';
import type { DirWatcher, } from './operations/watch-filesystem.ts';
import {
  extractHoverContent,
  toWireCompletionItems,
  toWireInlayHints,
  toWireSelectionRange,
} from './ws-conversions.ts';
import {
  type Peer,
  sendJson,
} from './ws-send.ts';

/**
 * Sends an empty result when no LSP manager is available.
 * Avoids repeating the null-check + empty-response pattern for each feature.
 *
 * @param peer - WebSocket peer to reply to
 *
 * @param message - pre-built empty result message
 *
 * @returns always true (message handled)
 */
function replyEmpty(
  {
    peer,
    message,
  }: {
    peer: Peer;
    message: Record<string, unknown>;
  },
): true {
  sendJson({
    peer,
    message,
  },);
  return true;
}

/**
 * Dispatches LSP-related client messages to the appropriate handler.
 *
 * @param peer - WebSocket peer that sent the message
 *
 * @param parsed - parsed client message
 *
 * @param rootDir - root directory for path containment
 *
 * @param lspManager - LSP server coordinator
 *
 * @param dirWatcher - filesystem watcher for directory registration
 *
 * @returns true if the message was handled, false if not an LSP message type
 */
export async function dispatchLspMessage(
  {
    peer,
    parsed,
    rootDir,
    lspManager,
    dirWatcher,
  }: {
    peer: Peer;
    parsed: ClientMessage;
    rootDir: string;
    lspManager: LspManager | null;
    dirWatcher: DirWatcher | null;
  },
): Promise<boolean> {
  if (parsed.type === 'inlayHint') {
    if (lspManager === null) {
      return replyEmpty({
        peer,
        message: {
          type: 'inlayHintResult',
          id: parsed.id,
          hints: [],
        },
      },);
    }
    const hints = await lspManager.inlayHints({
      path: parsed.path,
      range: parsed
        .range,
    },);
    sendJson({
      peer,
      message: {
        type: 'inlayHintResult',
        id: parsed.id,
        hints: toWireInlayHints({ hints, },),
      },
    },);
    return true;
  }
  if (parsed.type === 'didChange') {
    if (lspManager !== null) {
      await lspManager.didChange({
        path: parsed.path,
        text: parsed.content,
      },);
    }
    return true;
  }
  if (parsed.type === 'didClose') {
    if (lspManager !== null)
      await lspManager.didClose({ path: parsed.path, },);
    return true;
  }
  if (parsed.type === 'watchDir') {
    if (dirWatcher !== null) {
      const absolutePath = assertWithinRoot({
        rootDir,
        path: parsed.path,
      },);
      dirWatcher.watchDir({ path: absolutePath, },);
    }
    return true;
  }
  if (parsed.type === 'hover') {
    if (lspManager === null) {
      return replyEmpty({
        peer,
        message: {
          type: 'hoverResult',
          id: parsed.id,
          contents: '',
        },
      },);
    }
    const hover = await lspManager.hover({
      path: parsed.path,
      line: parsed.line,
      character: parsed.character,
    },);
    if (hover === null) {
      sendJson({
        peer,
        message: {
          type: 'hoverResult',
          id: parsed.id,
          contents: '',
        },
      },);
      return true;
    }
    sendJson({
      peer,
      message: {
        type: 'hoverResult',
        id: parsed.id,
        contents: extractHoverContent({ hover, },),
        range: hover.range,
      },
    },);
    return true;
  }
  if (parsed.type === 'completion') {
    if (lspManager === null) {
      return replyEmpty({
        peer,
        message: {
          type: 'completionResult',
          id: parsed.id,
          items: [],
        },
      },);
    }
    const items = await lspManager.completion({
      path: parsed.path,
      line: parsed.line,
      character: parsed.character,
    },);
    sendJson({
      peer,
      message: {
        type: 'completionResult',
        id: parsed.id,
        items: toWireCompletionItems({ items, },),
      },
    },);
    return true;
  }
  if (parsed.type === 'format') {
    if (lspManager === null) {
      return replyEmpty({
        peer,
        message: {
          type: 'formatResult',
          id: parsed.id,
          edits: [],
        },
      },);
    }
    const lspEdits = await lspManager.format({ path: parsed.path, },);
    const edits: TextEdit[] = lspEdits.map(function convertEdit(edit,) {
      return {
        range: edit.range,
        newText: edit.newText,
      };
    },);
    sendJson({
      peer,
      message: {
        type: 'formatResult',
        id: parsed.id,
        edits,
      },
    },);
    return true;
  }
  if (parsed.type === 'gotoDefinition') {
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
  if (parsed.type === 'findReferences') {
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
  if (parsed.type === 'selectionRange') {
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
    const lspRanges = await lspManager.selectionRange({
      path: parsed.path,
      positions: parsed.positions,
    },);
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
  if (parsed.type === 'prepareRename') {
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
  if (parsed.type === 'rename') {
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
    const fileEdits = await applyWorkspaceEdit({
      workspaceEdit,
      currentFilePath: parsed.path,
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
