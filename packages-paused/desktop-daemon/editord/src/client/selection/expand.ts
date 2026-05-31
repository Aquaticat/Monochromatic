/**
 * LSP-backed expand selection action.
 *
 * Requests the selection range chain from the server and picks the
 * first range strictly larger than the current selection.
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
  strictlyContains,
  toFlat,
} from './utils.ts';

/**
 * Tagged logger for selection expand.
 */
const expandLog = tagged({
  tag: 'selection-expand',
  l,
},);

/**
 * Expands the selection to the next larger syntactic scope.
 *
 * @param ws - WebSocket client for LSP requests
 *
 * @param editorPane - editor pane component
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @example
 * ```ts
 * await doExpandSelection({ ws: ws, editorPane: editorPane, getCurrentFilePath: '/home/user/project/src/main.ts', });
 * ```
 */
export async function doExpandSelection({
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
     * Current selection compared against chain entries to pick the next outer range.
     */
    const currentSel = editorPane.getSelection();

    /**
     * No selection or collapsed: apply the innermost range.
     */
    if ((currentSel === null)
      || ((currentSel.startLine
        === currentSel
        .endLine)
        && (currentSel.startCharacter
          === currentSel
          .endCharacter)))
    {
      /**
       * Innermost entry; undefined was guarded out by the length check above.
       */
      const [first,] = chain;
      if (first !== undefined) {
        editorPane.setSelection(toFlat({ sr: first, },),);
        expandLog.info(`expand: applied innermost range`,);
      }
      return;
    }

    /**
     * Find the first range strictly larger than the current selection.
     */
    for (const entry of chain) {
      /**
       * Flat form needed by {@link strictlyContains}.
       */
      const flat = toFlat({ sr: entry, },);
      if (strictlyContains({
        outer: flat,
        inner: currentSel,
      },)) {
        editorPane.setSelection(flat,);
        expandLog.info(
          `expand: ${flat.startLine}:${flat.startCharacter}-${flat.endLine}:${flat.endCharacter}`,
        );
        return;
      }
    }

    expandLog.info('expand: already at outermost range',);
  }
  catch (error) {
    expandLog.error(`expand failed: ${String(error,)}`,);
  }
}
