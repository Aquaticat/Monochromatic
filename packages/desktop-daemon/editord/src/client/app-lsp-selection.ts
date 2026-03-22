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

import type { SelectionRange, } from '../protocol.ts';
import type { EditorPane, } from './editor-pane.ts';
import { l, tagged, } from './log.ts';
import type { EditorWsClient, } from './ws-client.ts';

/** Tagged logger for selection range module. */
const selLog = tagged({ tag: 'selection-range', l, },);

/**
 * Flattens the nested `parent` chain of a {@link SelectionRange} into
 * a flat array ordered from innermost to outermost scope.
 *
 * @param root - top of the nested chain returned by the server
 *
 * @returns flat array where index 0 is the innermost range
 */
function flattenChain({ root, }: { root: SelectionRange }): SelectionRange[] {
  const result: SelectionRange[] = [];
  let current: SelectionRange | undefined = root;
  while (current !== undefined) {
    result.push(current,);
    current = current.parent;
  }
  return result;
}

/** Range coordinates used for comparison. */
type FlatRange = { startLine: number; startCharacter: number; endLine: number; endCharacter: number };

/**
 * Checks whether range `outer` strictly contains range `inner`
 * (i.e. outer is larger and fully encloses inner).
 *
 * @param outer - candidate larger range
 *
 * @param inner - candidate smaller range
 *
 * @returns true if outer strictly contains inner
 */
function strictlyContains({ outer, inner, }: { outer: FlatRange; inner: FlatRange }): boolean {
  const outerStartBefore = outer.startLine < inner.startLine
    || (outer.startLine === inner.startLine && outer.startCharacter < inner.startCharacter);
  const outerEndAfter = outer.endLine > inner.endLine
    || (outer.endLine === inner.endLine && outer.endCharacter > inner.endCharacter);
  const outerStartSame = outer.startLine === inner.startLine && outer.startCharacter === inner.startCharacter;
  const outerEndSame = outer.endLine === inner.endLine && outer.endCharacter === inner.endCharacter;

  /** Strictly larger: at least one boundary must differ outward. */
  if (outerStartBefore && outerEndAfter) return true;
  if (outerStartBefore && outerEndSame) return true;
  if (outerStartSame && outerEndAfter) return true;
  return false;
}

/**
 * Converts a {@link SelectionRange} to flat coordinates for comparison.
 *
 * @param sr - selection range from the chain
 *
 * @returns flat range coordinates
 */
function toFlat({ sr, }: { sr: SelectionRange }): FlatRange {
  return {
    startLine: sr.range.start.line,
    startCharacter: sr.range.start.character,
    endLine: sr.range.end.line,
    endCharacter: sr.range.end.character,
  };
}

/**
 * Fetches the selection range chain from the server and returns
 * the flattened array.
 *
 * @param ws - WebSocket client
 *
 * @param path - absolute file path
 *
 * @param line - 0-based cursor line
 *
 * @param character - 0-based cursor character
 *
 * @returns flattened chain from innermost to outermost, or empty
 */
async function fetchChain({ ws, path, line, character, }: {
  ws: EditorWsClient;
  path: string;
  line: number;
  character: number;
}): Promise<SelectionRange[]> {
  const r = await ws.request({ type: 'selectionRange', path, positions: [{ line, character, },], },);
  if (!('ranges' in r)) return [];
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrowed by 'ranges' in r
  const ranges = (r as { ranges: SelectionRange[] }).ranges;
  const first = ranges[0];
  if (first === undefined) return [];
  return flattenChain({ root: first, },);
}

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
          const first = chain[0];
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
          if (strictlyContains({ outer: currentSel, inner: flat, },)) {
            /** Pick the largest (first encountered from outer end) that fits. */
            if (best === null || strictlyContains({ outer: flat, inner: best, },)) {
              best = flat;
            }
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
