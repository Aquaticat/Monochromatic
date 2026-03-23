/**
 * LSP-backed expand/shrink selection for the editord client.
 *
 * Uses `textDocument/selectionRange` to obtain a chain of progressively
 * larger syntactic scopes. Ctrl+W picks the first range strictly larger
 * than the current selection (expand). Ctrl+Shift+W picks the largest
 * range strictly smaller (shrink).
 *
 * Each invocation re-requests the chain from the server, keeping the
 * client stateless and avoiding stale-range bugs.
 */

import type { EditorPane, } from './editor-pane.ts';
import { l, tagged, } from './log.ts';
import {
  type FlatRange,
  fetchChain,
  strictlyContains,
  toFlat,
} from './selection-range-utils.ts';
import type { EditorWsClient, } from './ws-client.ts';

/** Tagged logger for selection range module. */
const selLog = tagged({ tag: 'selection-range', l, },);

/**
 * Wires expand/shrink selection onto the editor.
 *
 * Returns `expandSelection` and `shrinkSelection` callbacks for keybinding use.
 * Each call re-requests the selection range chain from the server.
 *
 * @param ws - WebSocket client for LSP requests
 *
 * @param editorPane - editor pane component
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @returns expand and shrink callbacks
 */
export function wireSelectionRange({ ws, editorPane, getCurrentFilePath, }: {
  ws: EditorWsClient;
  editorPane: EditorPane;
  getCurrentFilePath: () => string | null;
}): { expandSelection: () => void; shrinkSelection: () => void } {

  /** Expands the selection to the next larger syntactic scope. */
  function expandSelection(): void {
    const path = getCurrentFilePath();
    if (path === null) return;

    const pos = editorPane.getCursorPosition();
    if (pos === null) return;

    void (async function doExpand(): Promise<void> {
      try {
        const chain = await fetchChain({ ws, path, line: pos.line, character: pos.character, },);
        if (chain.length === 0) return;

        const currentSel = editorPane.getSelection();

        /** No selection or collapsed — apply the innermost range. */
        if (currentSel === null
          || (currentSel.startLine === currentSel.endLine && currentSel.startCharacter === currentSel.endCharacter)) {
          const [first,] = chain;
          if (first !== undefined) {
            editorPane.setSelection(toFlat({ sr: first, },),);
            selLog.info(`expand: applied innermost range`,);
          }
          return;
        }

        /** Find the first range strictly larger than the current selection. */
        for (const entry of chain) {
          const flat = toFlat({ sr: entry, },);
          if (strictlyContains({ outer: flat, inner: currentSel, },)) {
            editorPane.setSelection(flat,);
            selLog.info(`expand: ${flat.startLine}:${flat.startCharacter}-${flat.endLine}:${flat.endCharacter}`,);
            return;
          }
        }

        selLog.info('expand: already at outermost range',);
      }
      catch (error) {
        selLog.error(`expand failed: ${String(error,)}`,);
      }
    })();
  }

  /** Shrinks the selection back to the previous (smaller) scope. */
  function shrinkSelection(): void {
    const path = getCurrentFilePath();
    if (path === null) return;

    const currentSel = editorPane.getSelection();
    if (currentSel === null) return;

    const pos = editorPane.getCursorPosition();
    if (pos === null) return;

    void (async function doShrink(): Promise<void> {
      try {
        const chain = await fetchChain({ ws, path, line: pos.line, character: pos.character, },);
        if (chain.length === 0) return;

        /**
         * Find the largest range strictly smaller than the current selection.
         * Walk the chain from outermost to innermost, picking the last one
         * that is strictly contained within the current selection.
         */
        let best: FlatRange | null = null;
        for (const entry of chain) {
          const flat = toFlat({ sr: entry, },);
          /** Without this combined check, the inner `best` comparison would run for non-contained ranges. */
          if (strictlyContains({ outer: currentSel, inner: flat, },)
            && (best === null || strictlyContains({ outer: flat, inner: best, },))) {
            best = flat;
          }
        }

        if (best !== null) {
          editorPane.setSelection(best,);
          selLog.info(`shrink: ${best.startLine}:${best.startCharacter}-${best.endLine}:${best.endCharacter}`,);
        }
        else {
          /** No smaller range — collapse to cursor. */
          editorPane.restoreCursor({ line: pos.line, character: pos.character, },);
          selLog.info('shrink: collapsed to cursor',);
        }
      }
      catch (error) {
        selLog.error(`shrink failed: ${String(error,)}`,);
      }
    })();
  }

  return { expandSelection, shrinkSelection, };
}
