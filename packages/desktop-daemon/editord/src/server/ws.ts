/**
 * WebSocket handler for editord.
 *
 * Authenticates connections via token in the URL query string,
 * then dispatches incoming messages to the appropriate operation handler.
 * Integrates with the LSP manager for language intelligence features.
 */

// oxlint-disable max-lines -- WebSocket handler with auth, message dispatch, LSP integration, and diagnostics push

import {
  defineWebSocketHandler,
  type EventHandler,
} from 'h3';

import type { ClientMessage, CompletionItem, InlayHint, TextEdit, } from '../protocol.ts';
import { l as rootLogger, tagged, } from './log.ts';
import type { LspManager, } from './lsp/lsp-manager.ts';
import type { LspCompletionItem, LspHover, LspInlayHint, LspMarkupContent, } from './lsp/types.ts';
import { assertWithinRoot, } from './operations/assert-within-root.ts';
import { listDir, } from './operations/list-dir.ts';
import { openFile, } from './operations/open.ts';
import { saveFile, } from './operations/save.ts';
import { search, } from './operations/search.ts';

/** Tagged logger for the WebSocket subsystem. */
const l = tagged({ tag: 'ws', l: rootLogger, },);

/**
 * Tracks the `AbortController` for the currently in-flight search per peer.
 * When a new search arrives, the previous one is aborted so its `rg` processes are killed.
 */
const peerSearchControllers = new WeakMap<object, AbortController>();

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
 * Extracts hover content as a plain string from an LSP hover result.
 * Handles MarkupContent objects and plain strings.
 *
 * @param hover - LSP hover result
 *
 * @returns string representation of the hover content
 */
function extractHoverContent({ hover, }: { hover: LspHover }): string {
  if (typeof hover.contents === 'string')
    return hover.contents;

  return (hover.contents as LspMarkupContent).value;
}

/**
 * Converts LSP completion items to wire format.
 *
 * @param items - LSP completion items
 *
 * @returns wire-format completion items
 */
function toWireCompletionItems({ items, }: { items: LspCompletionItem[] }): CompletionItem[] {
  return items.map(function convertItem(item,) {
    return {
      label: item.label,
      detail: item.detail ?? '',
      insertText: item.insertText ?? item.label,
    };
  },);
}

/**
 * Converts LSP inlay hints to wire format.
 * Extracts label text from string or structured label parts.
 *
 * @param hints - LSP inlay hints
 *
 * @returns wire-format inlay hints
 */
function toWireInlayHints({ hints, }: { hints: LspInlayHint[] }): InlayHint[] {
  return hints.map(function convertHint(hint,) {
    const label = typeof hint.label === 'string'
      ? hint.label
      : hint.label.map(function extractPart(part,) { return part.value; },).join('',);
    const result: InlayHint = { position: hint.position, label, };
    if (hint.kind !== undefined) result.kind = hint.kind;
    if (hint.paddingLeft !== undefined) result.paddingLeft = hint.paddingLeft;
    if (hint.paddingRight !== undefined) result.paddingRight = hint.paddingRight;
    return result;
  },);
}

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
 */
async function dispatchMessage(
  peer: { send: (data: string) => void },
  messageText: string,
  rootDir: string,
  lspManager: LspManager | null,
): Promise<void> {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; runtime type is validated by discriminant checks below
  const parsed = JSON.parse(messageText,) as ClientMessage;

  if (parsed.type === 'open') {
    const result = await openFile({ rootDir, path: parsed.path, },);
    peer.send(JSON.stringify({ type: 'fileContent', id: parsed.id, ...result, },),);

    /** Notify LSP servers about the opened file. */
    if (lspManager !== null && 'content' in result) {
      await lspManager.didOpen({ path: parsed.path, text: String(result.content,), },);
    }
  }
  else if (parsed.type === 'save') {
    await saveFile({ rootDir, path: parsed.path, content: parsed.content, },);
    peer.send(JSON.stringify({ type: 'saved', id: parsed.id, path: parsed.path, },),);

    /** Notify LSP servers about the save. */
    if (lspManager !== null) {
      await lspManager.didSave({ path: parsed.path, },);
    }
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  else if (parsed.type === 'listDir') {
    const result = await listDir({ rootDir, path: parsed.path, },);
    peer.send(JSON.stringify({ type: 'dirListing', id: parsed.id, ...result, },),);
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  else if (parsed.type === 'search') {
    peerSearchControllers.get(peer,)?.abort();
    const controller = new AbortController();
    peerSearchControllers.set(peer, controller,);

    assertWithinRoot({ rootDir, path: parsed.scope, },);
    const result = await search({ rootDir: parsed.scope, query: parsed.query, signal: controller.signal, },);

    if (!controller.signal.aborted)
      peer.send(JSON.stringify({ type: 'searchResults', id: parsed.id, ...result, },),);
  }
  //region LSP message handlers
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  else if (parsed.type === 'inlayHint') {
    if (lspManager === null) {
      peer.send(JSON.stringify({ type: 'inlayHintResult', id: parsed.id, hints: [], },),);
      return;
    }

    const hints = await lspManager.inlayHints({ path: parsed.path, range: parsed.range, },);
    peer.send(JSON.stringify({
      type: 'inlayHintResult',
      id: parsed.id,
      hints: toWireInlayHints({ hints, },),
    },),);
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  else if (parsed.type === 'didChange') {
    if (lspManager !== null) {
      await lspManager.didChange({ path: parsed.path, text: parsed.content, },);
    }
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  else if (parsed.type === 'didClose') {
    if (lspManager !== null) {
      await lspManager.didClose({ path: parsed.path, },);
    }
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  else if (parsed.type === 'hover') {
    if (lspManager === null) {
      peer.send(JSON.stringify({ type: 'hoverResult', id: parsed.id, contents: '', },),);
      return;
    }

    const hover = await lspManager.hover({ path: parsed.path, line: parsed.line, character: parsed.character, },);
    if (hover === null) {
      peer.send(JSON.stringify({ type: 'hoverResult', id: parsed.id, contents: '', },),);
      return;
    }

    peer.send(JSON.stringify({
      type: 'hoverResult',
      id: parsed.id,
      contents: extractHoverContent({ hover, },),
      range: hover.range,
    },),);
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  else if (parsed.type === 'completion') {
    if (lspManager === null) {
      peer.send(JSON.stringify({ type: 'completionResult', id: parsed.id, items: [], },),);
      return;
    }

    const items = await lspManager.completion({ path: parsed.path, line: parsed.line, character: parsed.character, },);
    peer.send(JSON.stringify({
      type: 'completionResult',
      id: parsed.id,
      items: toWireCompletionItems({ items, },),
    },),);
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  else if (parsed.type === 'format') {
    if (lspManager === null) {
      peer.send(JSON.stringify({ type: 'formatResult', id: parsed.id, edits: [], },),);
      return;
    }

    const lspEdits = await lspManager.format({ path: parsed.path, },);
    const edits: TextEdit[] = lspEdits.map(function convertEdit(edit,) {
      return { range: edit.range, newText: edit.newText, };
    },);
    peer.send(JSON.stringify({ type: 'formatResult', id: parsed.id, edits, },),);
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  else if (parsed.type === 'gotoDefinition') {
    if (lspManager === null) {
      peer.send(JSON.stringify({ type: 'definitionResult', id: parsed.id, path: '', line: 0, character: 0, },),);
      return;
    }

    const def = await lspManager.gotoDefinition({ path: parsed.path, line: parsed.line, character: parsed.character, },);
    if (def === null) {
      peer.send(JSON.stringify({ type: 'definitionResult', id: parsed.id, path: '', line: 0, character: 0, },),);
      return;
    }

    peer.send(JSON.stringify({
      type: 'definitionResult',
      id: parsed.id,
      path: def.path,
      line: def.line,
      character: def.character,
    },),);
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: parsed is from unvalidated JSON cast
  else if (parsed.type === 'findReferences') {
    if (lspManager === null) {
      peer.send(JSON.stringify({ type: 'referencesResult', id: parsed.id, locations: [], },),);
      return;
    }

    const locations = await lspManager.references({ path: parsed.path, line: parsed.line, character: parsed.character, },);
    peer.send(JSON.stringify({ type: 'referencesResult', id: parsed.id, locations, },),);
  }
  //endregion LSP message handlers
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
 * @param fsId - stable filesystem identifier for the volume containing rootDir
 *
 * @param lspManager - LSP server coordinator, or null if LSP is disabled
 *
 * @returns h3 event handler that upgrades to WebSocket
 */
export function createWsHandler({ authToken, rootDir, fsId, lspManager, connectedPeers, }: {
  authToken: string;
  rootDir: string;
  fsId: string;
  lspManager: LspManager | null;
  connectedPeers: Set<{ send: (data: string) => void }>;
}): EventHandler {
  return defineWebSocketHandler(function resolveHooks(event,) {
    const url = new URL(event.url, 'http://localhost',);
    const token = url.searchParams.get('token',);

    if (token !== authToken) {
      return { open: rejectUnauthenticated, };
    }

    return {
      open: function handleOpen(peer,) {
        l.info('peer connected',);
        connectedPeers.add(peer,);
        peer.send(JSON.stringify({ type: 'connected', rootDir, fsId, },),);
      },

      async message(peer, message,) {
        try {
          await dispatchMessage(peer, message.text(), rootDir, lspManager,);
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

      close: function handleClose(peer,) {
        peerSearchControllers.delete(peer,);
        connectedPeers.delete(peer,);
        l.info('peer disconnected',);
      },
    };
  },);
}
