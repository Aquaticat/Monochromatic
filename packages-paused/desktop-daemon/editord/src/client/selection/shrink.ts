/**
 * LSP-backed shrink selection action.
 *
 * Requests the selection range chain from the server and picks the
 * largest range strictly smaller than the current selection.
 */

import type {
  EditorPaneHandle,
  EditorWsClientHandle,
  GetCurrentFilePathFn,
} from '../app/types.ts';
import {
  l,
  tagged,
} from '../log.ts';
import { fetchChain, } from './fetch.ts';
import {
  type FlatRange,
  strictlyContains,
  toFlat,
} from './utils.ts';

/**
 * Tagged logger for selection shrink.
 */
const shrinkLog = tagged({
  tag: 'selection-shrink',
  l,
},);

/**
 * Shrinks the selection back to the previous (smaller) scope.
 * Collapses to cursor when no smaller range exists.
 *
 * @param ws - WebSocket client for LSP requests
 *
 * @param editorPane - editor pane component
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @example
 * ```ts
 * await doShrinkSelection({ ws: ws, editorPane: editorPane, getCurrentFilePath: '/home/user/project/src/main.ts', });
 * ```
 */
export async function doShrinkSelection({
  ws,
  editorPane,
  getCurrentFilePath,
}: {
  readonly ws: EditorWsClientHandle;
  readonly editorPane: EditorPaneHandle;
  readonly getCurrentFilePath: GetCurrentFilePathFn;
},): Promise<void> {
  /**
   * Skip when no file is open; LSP needs a target.
   */
  const path = getCurrentFilePath();
  if (path === null)
    return;

  /**
   * Existing selection compared against chain entries to pick the next inner range.
   */
  const currentSel = editorPane.getSelection();
  if (currentSel === null)
    return;

  /**
   * Cursor coords sent to the LSP `selectionRange` request.
   */
  const pos = editorPane.getCursorPosition();
  if (pos === null)
    return;

  try {
    /**
     * Innermost-first chain of ranges returned by the LSP.
     */
    const chain = await fetchChain({
      ws,
      path,
      line: pos.line,
      character: pos.character,
    },);
    if (chain.length
      === 0)
      return;

    /**
     * Find the largest range strictly smaller than the current selection.
     * Walk the chain from outermost to innermost, picking the last one
     * that is strictly contained within the current selection.
     */
    let best: FlatRange | null = null;
    for (const entry of chain) {
      /**
       * Flat form needed by {@link strictlyContains}.
       */
      const flat = toFlat({ sr: entry, },);
      /**
       * Without this combined check, the inner `best` comparison would run for non-contained ranges.
       */
      if (strictlyContains({
        outer: currentSel,
        inner: flat,
      },)
        && ((best === null) || strictlyContains({
          outer: flat,
          inner: best,
        },)))
      {
        best = flat;
      }
    }

    if (best !== null) {
      editorPane.setSelection(best,);
      shrinkLog.info(
        `shrink: ${best.startLine}:${best.startCharacter}-${best.endLine}:${best.endCharacter}`,
      );
    }
    else {
      /**
       * No smaller range: collapse to cursor.
       */
      editorPane.restoreCursor({
        line: pos.line,
        character: pos.character,
      },);
      shrinkLog.info('shrink: collapsed to cursor',);
    }
  }
  catch (error) {
    shrinkLog.error(`shrink failed: ${String(error,)}`,);
  }
}
