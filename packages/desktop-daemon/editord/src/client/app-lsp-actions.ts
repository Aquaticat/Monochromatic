/**
 * LSP actions: formatting and go-to-definition.
 */

import type { EditorPane, } from './editor-pane.ts';
import { l, tagged, } from './log.ts';
import { getPositionFromPoint, } from './position-from-point.ts';
import type { EditorWsClient, } from './ws-client.ts';

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
  loadFileSafe: (path: string, line?: number,) => Promise<void>;
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

/** Result of a go-to-definition attempt. */
export type GotoDefinitionResult = 'navigated' | 'no-definition' | 'already-at-definition' | 'error';

/**
 * Sends a go-to-definition request and navigates to the result.
 *
 * @param ws - WebSocket client
 *
 * @param getCurrentFilePath - returns the currently open file path
 *
 * @param loadFileSafe - loads a file, optionally scrolling to a line
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @returns result indicating whether navigation succeeded, found nothing, or errored
 */
export async function doGotoDefinition({ ws, getCurrentFilePath, loadFileSafe, line, character, }: {
  ws: EditorWsClient;
  getCurrentFilePath: () => string | null;
  loadFileSafe: (path: string, line?: number,) => Promise<void>;
  line: number; character: number;
}): Promise<GotoDefinitionResult> {
  const path = getCurrentFilePath();
  if (path === null) return 'no-definition';
  actionLog.info(`requesting definition at ${path}:${line}:${character}`,);
  try {
    const response = await ws.request({ type: 'gotoDefinition', path, line, character, },);
    actionLog.info(`definition response: ${JSON.stringify(response,)}`,);
    if ('path' in response && 'line' in response) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- response narrowed by discriminant checks
      const def = response as { path: string; line: number };
      if (def.path !== '') {
        if (def.path === path && def.line === line) return 'already-at-definition';
        await loadFileSafe(def.path, def.line + 1,);
        return 'navigated';
      }
    }
    return 'no-definition';
  }
  catch (error) {
    actionLog.error(`go-to-definition failed: ${String(error,)}`,);
    return 'error';
  }
}
