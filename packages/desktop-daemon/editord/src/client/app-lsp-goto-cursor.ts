/**
 * Go-to-definition-at-cursor action for the editord client.
 *
 * Resolves the cursor position, attempts go-to-definition, and falls
 * back to showing references when already at the definition.
 */

import { doGotoDefinition, } from './app-lsp-goto-definition.ts';
import { showReferences, } from './app-lsp-references.ts';
import type { EditorPane, } from './editor-pane.ts';
import type { HoverPopup, } from './hover-popup.ts';
import { l, tagged, } from './log.ts';
import type { ReferencesPopup, } from './references-popup.ts';
import { showCursorToast, } from './toast.ts';
import type { EditorWsClient, } from './ws-client.ts';

/** Tagged logger for goto-definition-at-cursor. */
const cursorLog = tagged({ tag: 'lsp-goto-cursor', l, },);

/**
 * Performs go-to-definition at the current cursor position.
 * If already at the definition, shows references instead.
 * Shows toast messages for no-definition and error results.
 *
 * @param ws - WebSocket client
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @param loadFileSafe - loads a file, optionally scrolling to a line
 *
 * @param hoverPopup - hover popup to hide before navigation
 *
 * @param editorPane - editor pane for cursor position
 *
 * @param referencesPopup - references popup for fallback display
 */
export function performGotoAtCursor({ ws, getCurrentFilePath, loadFileSafe, hoverPopup, editorPane, referencesPopup, }: {
  ws: EditorWsClient;
  getCurrentFilePath: () => string | null;
  loadFileSafe: (opts: { path: string; line?: number | undefined; character?: number | undefined }) => Promise<void>;
  hoverPopup: HoverPopup;
  editorPane: EditorPane;
  referencesPopup: ReferencesPopup;
}): void {
  hoverPopup.hide();
  const pos = editorPane.getCursorPosition();
  const rect = editorPane.getCursorRect();
  if (pos === null || rect === null) {
    cursorLog.info('could not resolve editor cursor position',);
    return;
  }
  cursorLog.info(`line=${pos.line} character=${pos.character}`,);
  void (async function navigateOrFindReferences(): Promise<void> {
    const result = await doGotoDefinition({ ws, getCurrentFilePath, loadFileSafe, line: pos.line, character: pos.character, },);
    if (result === 'no-definition') { showCursorToast({ message: 'No definition found', rect, },); return; }
    if (result === 'error') { showCursorToast({ message: 'Go to definition failed', rect, },); return; }
    if (result !== 'already-at-definition') return;
    await showReferences({ ws, referencesPopup, getCurrentFilePath, line: pos.line, character: pos.character, rect, },);
  })();
}
