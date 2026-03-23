/**
 * LSP actions: formatting and Ctrl+Click go-to-definition wiring.
 */

import type { EditorPane, } from '../editor/editor-pane.ts';
import { l, tagged, } from '../log.ts';
import { doGotoDefinition, } from './lsp-goto-definition.ts';
import { getPositionFromPoint, } from '../position-from-point.ts';
import type { EditorWsClient, } from '../ws/client.ts';

export { doGotoDefinition, };
export type { GotoDefinitionResult, } from './lsp-goto-definition.ts';

/** Tagged logger for LSP actions. */
const actionLog = tagged({ tag: 'lsp-actions', l, },);

/**
 * Requests document formatting from the server and applies edits.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane to apply edits to
 *
 * @param getCurrentFilePath - returns the currently open file path
 */
export async function formatDocument({ ws, editorPane, getCurrentFilePath, }: {
  ws: EditorWsClient;
  editorPane: EditorPane;
  getCurrentFilePath: () => string | null;
}): Promise<void> {
  const path = getCurrentFilePath();
  if (path === null) return;
  try {
    const response = await ws.request({ type: 'format', path, },);
    if ('edits' in response) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- response narrowed by 'edits' check
      const { edits, } = response as { edits: { range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }[] };
      if (edits.length > 0) editorPane.applyTextEdits(edits,);
    }
  }
  catch (error) { actionLog.error(`formatting failed: ${String(error,)}`,); }
}

/**
 * Wires Ctrl+Click go-to-definition on the editor pane.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane to listen for click events
 *
 * @param getEditorElement - returns the contenteditable container
 *
 * @param getCurrentFilePath - returns the currently open file path
 *
 * @param loadFileSafe - loads a file with error handling
 */
export function wireGotoDefinition({ ws, editorPane, getEditorElement, getCurrentFilePath, loadFileSafe, }: {
  ws: EditorWsClient;
  editorPane: HTMLElement;
  getEditorElement: () => HTMLElement | null;
  getCurrentFilePath: () => string | null;
  loadFileSafe: (opts: { path: string; line?: number | undefined; character?: number | undefined }) => Promise<void>;
}): void {
  editorPane.addEventListener('click', function handleCtrlClick(event,) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- click is always a MouseEvent
    const me = event as MouseEvent;
    if (!me.ctrlKey && !me.metaKey) return;
    const el = getEditorElement();
    if (el === null) return;
    const pos = getPositionFromPoint({ editor: el, x: me.clientX, y: me.clientY, },);
    if (pos === null) return;
    void doGotoDefinition({ ws, getCurrentFilePath, loadFileSafe, line: pos.line, character: pos.character, },);
  },);
}
