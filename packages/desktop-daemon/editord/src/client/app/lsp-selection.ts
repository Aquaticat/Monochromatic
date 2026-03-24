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

import type { EditorPane, } from '../editor/editor-pane.ts';
import { doExpandSelection, } from '../selection/expand.ts';
import { doShrinkSelection, } from '../selection/shrink.ts';
import type { EditorWsClient, } from '../ws/client.ts';

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
},): { expandSelection: () => void; shrinkSelection: () => void; } {
  return {
    expandSelection: function expand(): void {
      doExpandSelection({ ws, editorPane, getCurrentFilePath, },);
    },
    shrinkSelection: function shrink(): void {
      doShrinkSelection({ ws, editorPane, getCurrentFilePath, },);
    },
  };
}
