/**
 * Completion popup wiring for the editord client.
 *
 * Handles dot-trigger, Ctrl+Space, positions the popup at the caret,
 * suppresses dot-triggers inside string literals, discards stale
 * responses when the cursor moves during the LSP roundtrip, and
 * auto-dismisses the popup when the cursor leaves the trigger position.
 */

import type { CompletionPopup, } from '../completion/completion-popup.ts';
import { getLineText, } from '../editor/editor-pane-dom.ts';
import type { EditorPane, } from '../editor/editor-pane.ts';
import {
  l,
  tagged,
} from '../log.ts';
import type { EditorWsClient, } from '../ws/client.ts';

import type { GetCurrentFilePathFn, } from './types.ts';

/** Tagged logger for completions. */
const completionLog = tagged({
  tag: 'completions',
  l,
},);

/**
 * Reports whether the position at `character` on `line` is inside a string literal.
 * Counts unescaped string delimiters on the same line; a non-null state at the
 * cursor means the dot is inside an unclosed string.
 *
 * Multi-line template literals are not detected; that is acceptable for an MVP
 * since dot-completions inside them are rare.
 *
 * @param line - source text of the current line
 *
 * @param character - 0-based cursor offset within the line
 *
 * @returns true when the cursor lies inside single-quote, double-quote, or
 * backtick-quoted content
 *
 * @example
 * ```ts
 * isInsideStringLiteral({ line: "'hello.'", character: 7, });
 * ```
 */
function isInsideStringLiteral({
  line,
  character,
}: {
  line: string;
  character: number;
},): boolean {
  let active: '"' | "'" | '`' | null = null;
  let i = 0;
  while (i < character) {
    const ch = line[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (active === null) {
      if (ch === '"' || ch === "'" || ch === '`')
        active = ch;
    }
    else if (ch === active) {
      active = null;
    }
    i += 1;
  }
  return active !== null;
}

/**
 * Requests completions from the server and shows the popup.
 *
 * Discards responses whose request cursor no longer matches the editor cursor
 * so rapid typing does not produce a popup at the wrong location.
 *
 * @param ws - WebSocket client
 *
 * @param completionPopup - completion popup to populate
 *
 * @param editorPane - editor pane component for cursor position
 *
 * @param getCurrentFilePath - returns the currently open file path
 *
 * @example
 * ```ts
 * await requestCompletions({ ws, completionPopup, editorPane, getCurrentFilePath, });
 * ```
 */
export async function requestCompletions(
  {
    ws,
    completionPopup,
    editorPane,
    getCurrentFilePath,
  }: {
    ws: EditorWsClient;
    completionPopup: CompletionPopup;
    editorPane: EditorPane;
    getCurrentFilePath: GetCurrentFilePathFn;
  },
): Promise<void> {
  const path = getCurrentFilePath();
  if (path === null)
    return;
  const requestPos = editorPane.getCursorPosition();
  if (requestPos === null)
    return;

  try {
    const response = await ws.request({
      type: 'completion',
      path,
      line: requestPos.line,
      character: requestPos.character,
    },);
    if (!('items' in response))
      return;
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- response narrowed by 'items' check
    const { items, } = response as {
      items: {
        label: string;
        detail: string;
        insertText: string;
      }[];
    };
    const responsePos = editorPane.getCursorPosition();
    if (responsePos === null)
      return;
    if (
      responsePos.line !== requestPos.line
      || responsePos.character !== requestPos.character
    ) {
      return;
    }
    const rect = editorPane.getCursorRect();
    if (items.length === 0 || rect === null)
      return;
    completionPopup.show({
      items,
      x: rect.left,
      y: rect.bottom,
      cursor: responsePos,
    },);
  }
  catch (error) {
    completionLog.error(`completion request failed: ${String(error,)}`,);
  }
}

/**
 * Wires dot-trigger for completions on the editor pane.
 *
 * Only fires when the dot lands outside a string literal so typing prose
 * inside quotes does not flood the popup with global identifiers.
 *
 * @param editorPane - editor pane to listen for keydown events
 *
 * @param triggerCompletions - callback to invoke when dot is typed
 *
 * @example
 * ```ts
 * wireCompletionTrigger({ editorPane, triggerCompletions, });
 * ```
 */
export function wireCompletionTrigger({
  editorPane,
  triggerCompletions,
}: {
  editorPane: EditorPane;
  triggerCompletions: () => void;
},): void {
  editorPane.addEventListener(
    'keydown',
    function handleDotKey(event,) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- keydown is always a KeyboardEvent
      const ke = event as KeyboardEvent;
      if (ke.key !== '.')
        return;
      globalThis.setTimeout(
        function deferredTrigger() {
          const pos = editorPane.getCursorPosition();
          if (pos === null)
            return;
          const editorEl = editorPane.getEditorElement();
          if (editorEl === null)
            return;
          const lineText = getLineText({
            editor: editorEl,
            line: pos.line,
          },);
          if (lineText === null)
            return;
          /** The dot has already been inserted; check the position before it. */
          const dotIndex = pos.character - 1;
          if (dotIndex < 0)
            return;
          if (isInsideStringLiteral({
            line: lineText,
            character: dotIndex,
          },)) {
            return;
          }
          triggerCompletions();
        },
        0,
      );
    },
  );
}

/**
 * Hides the completion popup whenever the editor cursor moves away from the
 * position captured at the latest `show()`. Mouse clicks change the selection,
 * which fires `selectionchange`, so this also handles light-click dismissal.
 *
 * @param completionPopup - popup whose visibility this owner controls
 *
 * @param editorPane - editor pane providing the cursor position
 *
 * @example
 * ```ts
 * wireCompletionDismiss({ completionPopup, editorPane, });
 * ```
 */
export function wireCompletionDismiss({
  completionPopup,
  editorPane,
}: {
  completionPopup: CompletionPopup;
  editorPane: EditorPane;
},): void {
  document.addEventListener(
    'selectionchange',
    function handleSelectionChange() {
      if (!completionPopup.visible)
        return;
      const { shownAt, } = completionPopup;
      if (shownAt === null)
        return;
      const pos = editorPane.getCursorPosition();
      if (pos === null)
        return;
      if (pos.line !== shownAt.line || pos.character !== shownAt.character)
        completionPopup.hide();
    },
  );
}
