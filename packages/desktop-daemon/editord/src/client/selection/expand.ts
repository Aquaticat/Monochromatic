/**
 * LSP-backed expand selection action.
 *
 * Requests the selection range chain from the server and picks the
 * first range strictly larger than the current selection.
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
  strictlyContains,
  toFlat,
} from './utils.ts';

/** Tagged logger for selection expand. */
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
  ws: EditorWsClient;
  editorPane: EditorPane;
  getCurrentFilePath: GetCurrentFilePathFn;
},): Promise<void> {
  const path = getCurrentFilePath();
  if (path === null)
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

    const currentSel = editorPane.getSelection();

    /** No selection or collapsed: apply the innermost range. */
    if (currentSel === null
      || (currentSel.startLine === currentSel.endLine
        && currentSel.startCharacter === currentSel.endCharacter))
    {
      const [first,] = chain;
      if (first !== undefined) {
        editorPane.setSelection(toFlat({ sr: first, },),);
        expandLog.info(`expand: applied innermost range`,);
      }
      return;
    }

    /** Find the first range strictly larger than the current selection. */
    for (const entry of chain) {
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
