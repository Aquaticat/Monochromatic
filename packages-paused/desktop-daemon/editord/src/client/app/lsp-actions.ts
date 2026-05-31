/**
 * LSP actions: formatting and Ctrl+Click go-to-definition wiring.
 */

import {
  l,
  tagged,
} from '../log.ts';

import { doGotoDefinition, } from './lsp-goto-definition.ts';
import type {
  EditorPaneHandle,
  EditorWsClientHandle,
  GetCurrentFilePathFn,
  LoadFileFn,
} from './types.ts';

export { doGotoDefinition, };
export type { GotoDefinitionResult, } from './lsp-goto-definition.ts';

/**
 * Tagged logger for LSP actions.
 */
const actionLog = tagged({
  tag: 'lsp-actions',
  l,
},);

/**
 * Requests document formatting from the server and applies edits.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane to apply edits to
 *
 * @param getCurrentFilePath - returns the currently open file path
 *
 * @example
 * ```ts
 * await formatDocument({ ws: ws, editorPane: editorPane, getCurrentFilePath: '/home/user/project/src/main.ts', });
 * ```
 */
export async function formatDocument({
  ws,
  editorPane,
  getCurrentFilePath,
}: {
  readonly ws: EditorWsClientHandle;
  readonly editorPane: EditorPaneHandle;
  readonly getCurrentFilePath: GetCurrentFilePathFn;
},): Promise<void> {
  /**
   * Current file path; null when no buffer is open, in which case formatting has no target.
   */
  const path = getCurrentFilePath();
  if (path === null)
    return;
  try {
    /**
     * Edits returned by the formatter; empty when the document is already well-formed.
     */
    const { edits, } = await ws.request({
      type: 'format',
      path,
    },);
    if (edits.length
      > 0)
      editorPane.applyTextEdits(edits,);
  }
  catch (error) {
    actionLog.error(`formatting failed: ${String(error,)}`,);
  }
}

/**
 * Wires Ctrl+Click go-to-definition on the editor pane.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane component for click events and hit-testing
 *
 * @param getCurrentFilePath - returns the currently open file path
 *
 * @param loadFileSafe - loads a file with error handling
 *
 * @example
 * ```ts
 * wireGotoDefinition({ ws: ws, editorPane: editorPane, getCurrentFilePath: '/home/user/project/src/main.ts', loadFileSafe: loadFileSafe, });
 * ```
 */
export function wireGotoDefinition(
  {
    ws,
    editorPane,
    getCurrentFilePath,
    loadFileSafe,
  }: {
    readonly ws: EditorWsClientHandle;
    readonly editorPane: EditorPaneHandle;
    readonly getCurrentFilePath: GetCurrentFilePathFn;
    readonly loadFileSafe: LoadFileFn;
  },
): void {
  editorPane.addEventListener(
    'click',
    function handleCtrlClick(event,) {
      /**
       * Click event narrowed to MouseEvent so modifier flags and viewport coords are accessible.
       */
      const me = event as MouseEvent;
      if ((!me.ctrlKey) && (!me.metaKey))
        return;
      /**
       * Editor-space position under the cursor; null when the click misses any text.
       */
      const pos = editorPane.getPositionFromPoint({
        x: me.clientX,
        y: me.clientY,
      },);
      if (pos === null)
        return;
      void doGotoDefinition({
        ws,
        getCurrentFilePath,
        loadFileSafe,
        line: pos.line,
        character: pos.character,
      },);
    },
  );
}
