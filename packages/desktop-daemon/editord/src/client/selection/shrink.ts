/**
 * LSP-backed shrink selection action.
 *
 * Requests the selection range chain from the server and picks the
 * largest range strictly smaller than the current selection.
 */

import type { EditorPane, } from '../editor/editor-pane.ts';
import {
  l,
  tagged,
} from '../log.ts';
import type { EditorWsClient, } from '../ws/client.ts';

import type { GetCurrentFilePathFn, } from '../app/types.ts';
import { fetchChain, } from './fetch.ts';
import {
  type FlatRange,
  strictlyContains,
  toFlat,
} from './utils.ts';

/** Tagged logger for selection shrink. */
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
  ws: EditorWsClient;
  editorPane: EditorPane;
  getCurrentFilePath: GetCurrentFilePathFn;
},): Promise<void> {
  const path = getCurrentFilePath();
  if (path === null)
    return;

  const currentSel = editorPane.getSelection();
  if (currentSel === null)
    return;

  const pos = editorPane.getCursorPosition();
  if (pos === null)
    return;

  try {
    const chain = await fetchChain({
      ws,
      path,
      line: pos.line,
      character: pos.character,
    },);
    if (chain.length === 0)
      return;

    /**
     * Find the largest range strictly smaller than the current selection.
     * Walk the chain from outermost to innermost, picking the last one
     * that is strictly contained within the current selection.
     */
    let best: FlatRange | null = null;
    for (const entry of chain) {
      const flat = toFlat({ sr: entry, },);
      /** Without this combined check, the inner `best` comparison would run for non-contained ranges. */
      if (strictlyContains({
        outer: currentSel,
        inner: flat,
      },)
        && (best === null || strictlyContains({
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
      /** No smaller range: collapse to cursor. */
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
