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
import { assertWithinRoot, } from './operations/assert-within-root.ts';
import type { DirWatcher, } from './operations/watch-filesystem.ts';
import {
  extractHoverContent,
  toWireCompletionItems,
  toWireInlayHints,
} from './ws-conversions.ts';
import { dispatchLspFeatureMessage, } from './ws-dispatch-lsp-features.ts';
import {
  type Peer,
  replyEmpty,
  sendJson,
} from './ws-send.ts';

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
 *
 * @example
 * ```ts
 * const handled = await dispatchLspMessage({ peer, parsed: { type: 'hover', id: '1', path: 'src/app.ts', line: 5, character: 12 }, rootDir: '/home/user/project', lspManager, dirWatcher, });
 * ```
 */
export async function dispatchLspMessage(
  {
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
  },
): Promise<boolean> {
  if (parsed.type
    === 'inlayHint') {
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
    /**
     * Inlay-hint records returned by the manager; converted to wire form below.
     */
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
  if (parsed.type
    === 'didChange') {
    if (lspManager !== null) {
      await lspManager.didChange({
        path: parsed.path,
        text: parsed.content,
      },);
    }
    return true;
  }
  if (parsed.type
    === 'didClose') {
    if (lspManager !== null)
      await lspManager.didClose({ path: parsed.path, },);
    return true;
  }
  if (parsed.type
    === 'watchDir') {
    if (dirWatcher !== null) {
      /**
       * Resolved root-rebased path required by the chokidar watcher.
       */
      const absolutePath = assertWithinRoot({
        rootDir,
        path: parsed.path,
      },);
      dirWatcher.watchDir({ path: absolutePath, },);
    }
    return true;
  }
  if (parsed.type
    === 'hover') {
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
    /**
     * LSP hover payload; null branch sends an empty result below.
     */
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
  if (parsed.type
    === 'completion') {
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
    /**
     * Completion records returned by the manager; converted to wire form below.
     */
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
  if (parsed.type
    === 'format') {
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
    /**
     * LSP-shape edits converted to the editord wire shape on the next line.
     */
    const lspEdits = await lspManager.format({ path: parsed.path, },);
    /**
     * Wire-shape edits sent to the client.
     */
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
  return dispatchLspFeatureMessage({
    peer,
    parsed,
    lspManager,
    dirWatcher,
  },);
}
