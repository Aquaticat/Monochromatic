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

import { doExpandSelection, } from '../selection/expand.ts';
import { doShrinkSelection, } from '../selection/shrink.ts';

import type {
  EditorPaneHandle,
  EditorWsClientHandle,
  GetCurrentFilePathFn,
} from './types.ts';

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
 *
 * @example
 * ```ts
 * const result = wireSelectionRange({ ws: ws, editorPane: editorPane, getCurrentFilePath: '/home/user/project/src/main.ts', });
 * ```
 */
export function wireSelectionRange({
  ws,
  editorPane,
  getCurrentFilePath,
}: {
  readonly ws: EditorWsClientHandle;
  readonly editorPane: EditorPaneHandle;
  readonly getCurrentFilePath: GetCurrentFilePathFn;
},): {
  readonly expandSelection: () => void;
  readonly shrinkSelection: () => void;
} {
  return {
    expandSelection: function expand(): void {
      void doExpandSelection({
        ws,
        editorPane,
        getCurrentFilePath,
      },);
    },
    shrinkSelection: function shrink(): void {
      void doShrinkSelection({
        ws,
        editorPane,
        getCurrentFilePath,
      },);
    },
  };
}
