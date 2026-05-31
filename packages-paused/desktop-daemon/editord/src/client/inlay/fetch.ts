/**
 * Fetches inlay hints from the editord server.
 *
 * Requests hints for the entire visible file range and applies
 * them to the editor pane. Discards stale responses when the
 * file changes during the async request.
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

/**
 * Tagged logger for inlay hints.
 */
const inlayLog = tagged({
  tag: 'inlay',
  l,
},);

/**
 * Requests inlay hints from the server for the entire file.
 * Uses the editor's line count to determine the range.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane component
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @example
 * ```ts
 * await fetchInlayHints({ ws: ws, editorPane: editorPane, getCurrentFilePath: '/home/user/project/src/main.ts', });
 * ```
 */
export async function fetchInlayHints({
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

  try {
    /**
     * Whole-document range so the inlay query covers every line.
     */
    const range = editorPane.getDocumentRange();
    if (range === null)
      return;

    /**
     * Hints destructured directly; the rest of the response is unused here.
     */
    const { hints, } = await ws.request({
      type: 'inlayHint',
      path,
      range,
    },);

    /**
     * Verify the file hasn't changed while awaiting the response.
     */
    if (path !== getCurrentFilePath())
      return;

    editorPane.setInlayHints(hints,);
  }
  catch (error) {
    inlayLog.error(`failed to fetch inlay hints: ${String(error,)}`,);
  }
}
