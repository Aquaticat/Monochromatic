/**
 * Go-to-definition-at-cursor action for the editord client.
 *
 * Resolves the cursor position, attempts go-to-definition, and falls
 * back to showing references when already at the definition.
 */

import type { EditorPane, } from '../editor/editor-pane.ts';
import type { HoverPopup, } from '../hover/hover-popup.ts';
import {
  l,
  tagged,
} from '../log.ts';
import type { ReferencesPopup, } from '../references/references-popup.ts';
import { showCursorToast, } from '../toast/toast.ts';
import type { EditorWsClient, } from '../ws/client.ts';

import type {
  GetCurrentFilePathFn,
  LoadFileFn,
} from './types.ts';
import { doGotoDefinition, } from './lsp-goto-definition.ts';
import { showReferences, } from './lsp-references.ts';

/** Tagged logger for goto-definition-at-cursor. */
const cursorLog = tagged({
  tag: 'lsp-goto-cursor',
  l,
},);

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
export function performGotoAtCursor(
  {
    ws,
    getCurrentFilePath,
    loadFileSafe,
    hoverPopup,
    editorPane,
    referencesPopup,
  }: {
    ws: EditorWsClient;
    getCurrentFilePath: GetCurrentFilePathFn;
    loadFileSafe: LoadFileFn;
    hoverPopup: HoverPopup;
    editorPane: EditorPane;
    referencesPopup: ReferencesPopup;
  },
): void {
  hoverPopup.hide();
  const pos = editorPane.getCursorPosition();
  const rect = editorPane.getCursorRect();
  if (pos === null || rect === null) {
    cursorLog.info('could not resolve editor cursor position',);
    return;
  }
  cursorLog.info(`line=${pos.line} character=${pos.character}`,);
  void navigateOrFindReferences({
    ws,
    getCurrentFilePath,
    loadFileSafe,
    referencesPopup,
    line: pos.line,
    character: pos.character,
    rect,
  },);
}

/**
 * Attempts go-to-definition, falling back to find-references
 * when already at the definition site.
 *
 * @param ws - WebSocket client
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @param loadFileSafe - file loading function
 *
 * @param referencesPopup - popup to show references in
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @param rect - cursor bounding rect for toast/popup positioning
 */
async function navigateOrFindReferences({
  ws,
  getCurrentFilePath,
  loadFileSafe,
  referencesPopup,
  line,
  character,
  rect,
}: {
  ws: EditorWsClient;
  getCurrentFilePath: GetCurrentFilePathFn;
  loadFileSafe: LoadFileFn;
  referencesPopup: ReferencesPopup;
  line: number;
  character: number;
  rect: DOMRect;
},): Promise<void> {
  const result = await doGotoDefinition({
    ws,
    getCurrentFilePath,
    loadFileSafe,
    line,
    character,
  },);
  if (result === 'no-definition') {
    showCursorToast({
      message: 'No definition found',
      rect,
    },);
    return;
  }
  if (result === 'error') {
    showCursorToast({
      message: 'Go to definition failed',
      rect,
    },);
    return;
  }
  if (result !== 'already-at-definition')
    return;
  await showReferences({
    ws,
    referencesPopup,
    getCurrentFilePath,
    line,
    character,
    rect,
  },);
}
