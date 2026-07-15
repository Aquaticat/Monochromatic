/**
 * Go-to-definition-at-cursor action for the editord client.
 *
 * Resolves the cursor position, attempts go-to-definition, and falls
 * back to showing references when already at the definition.
 */

import {
  l,
  tagged,
} from '../log.ts';
import { showCursorToast, } from '../toast/toast.ts';
import { doGotoDefinition, } from './lsp-goto-definition.ts';
import { showReferences, } from './lsp-references.ts';
import type {
  EditorPaneHandle,
  EditorWsClientHandle,
  GetCurrentFilePathFn,
  HoverPopupHandle,
  LoadFileFn,
  ReferencesPopupHandle,
} from './types.ts';

/**
 * Tagged logger for goto-definition-at-cursor.
 */
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
 *
 * @example
 * ```ts
 * performGotoAtCursor({ ws: ws, getCurrentFilePath: '/home/user/project/src/main.ts', loadFileSafe: loadFileSafe, hoverPopup: hoverPopup, editorPane: editorPane, referencesPopup: referencesPopup, });
 * ```
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
    readonly ws: EditorWsClientHandle;
    readonly getCurrentFilePath: GetCurrentFilePathFn;
    readonly loadFileSafe: LoadFileFn;
    readonly hoverPopup: HoverPopupHandle;
    readonly editorPane: EditorPaneHandle;
    readonly referencesPopup: ReferencesPopupHandle;
  },
): void {
  hoverPopup.hide();
  /**
   * Cursor coords sent to LSP definition/references requests.
   */
  const pos = editorPane.getCursorPosition();
  /**
   * Screen rect anchors the toast and references popup.
   */
  const rect = editorPane.getCursorRect();
  if ((pos === null) || (rect === null)) {
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
  readonly ws: EditorWsClientHandle;
  readonly getCurrentFilePath: GetCurrentFilePathFn;
  readonly loadFileSafe: LoadFileFn;
  readonly referencesPopup: ReferencesPopupHandle;
  readonly line: number;
  readonly character: number;
  readonly rect: DOMRect;
},): Promise<void> {
  /**
   * Outcome literal driving the branch chain below.
   */
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
