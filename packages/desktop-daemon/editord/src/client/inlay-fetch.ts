/**
 * Fetches inlay hints from the editord server.
 *
 * Requests hints for the entire visible file range and applies
 * them to the editor pane. Discards stale responses when the
 * file changes during the async request.
 */

import type { InlayHint, } from '../protocol.ts';
import type { EditorPane, } from './editor-pane.ts';
import { l, tagged, } from './log.ts';
import type { EditorWsClient, } from './ws-client.ts';

/** Tagged logger for inlay hints. */
const inlayLog = tagged({ tag: 'inlay', l, },);

/**
 * Requests inlay hints from the server for the entire file.
 * Uses the editor's line count to determine the range.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane component
 *
 * @param getCurrentFilePath - returns the current file path
 */
export async function fetchInlayHints({ ws, editorPane, getCurrentFilePath, }: {
  ws: EditorWsClient;
  editorPane: EditorPane;
  getCurrentFilePath: () => string | null;
}): Promise<void> {
  const path = getCurrentFilePath();
  if (path === null)
    return;

  try {
    const text = editorPane.getText();
    const lines = text.split('\n',);
    const lastLineIndex = Math.max(0, lines.length - 1,);
    const lastLineLength = lines[lastLineIndex]?.length ?? 0;

    const result = await ws.request({
      type: 'inlayHint',
      path,
      range: {
        start: { line: 0, character: 0, },
        end: { line: lastLineIndex, character: lastLineLength, },
      },
    },);

    /** Verify the file hasn't changed while awaiting the response. */
    if (path !== getCurrentFilePath())
      return;

    if ('hints' in result) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- discriminant check above narrows to inlayHintResult
      editorPane.setInlayHints(result.hints as InlayHint[],);
    }
  }
  catch (error) {
    inlayLog.error(`failed to fetch inlay hints: ${String(error,)}`,);
  }
}
