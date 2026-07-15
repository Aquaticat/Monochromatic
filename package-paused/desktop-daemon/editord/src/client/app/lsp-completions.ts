/**
 * Completion popup wiring for the editord client.
 *
 * Handles dot-trigger, Ctrl+Space, positions the popup at the caret,
 * suppresses dot-triggers inside string literals, discards stale
 * responses when the cursor moves during the LSP roundtrip, and
 * auto-dismisses the popup when the cursor leaves the trigger position.
 */

import { getLineText, } from '../editor/editor-pane-dom.ts';
import {
  l,
  tagged,
} from '../log.ts';
import type {
  CompletionPopupHandle,
  EditorPaneHandle,
  EditorWsClientHandle,
  GetCurrentFilePathFn,
} from './types.ts';

/**
 * Tagged logger for completions.
 */
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
  readonly line: string;
  readonly character: number;
},): boolean {
  /**
   * Currently-open string delimiter, or null when the walker is outside any string.
   *
   * Tracks the active quote character (double-quote, single-quote, or backtick) as
   * the walker advances; flipped back to null when the matching delimiter is hit.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- parser-cursor state machine: `active` is flipped by quote-open/close branches while `i` walks the string
  let active: '"' | "'" | '`' | null = null;
  /**
   * Cursor into `line`; advances by 1 for normal characters, by 2 across backslash escapes.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- parser-cursor state machine: `i` advances asymmetrically (1 or 2) based on backslash branch
  let i = 0;
  while (i < character) {
    /**
     * Character at the walker's current position; undefined past the end of the line.
     */
    const ch = line[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (active === null) {
      if ((ch === '"') || (ch === "'")
        || (ch === '`'))
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
    readonly ws: EditorWsClientHandle;
    readonly completionPopup: CompletionPopupHandle;
    readonly editorPane: EditorPaneHandle;
    readonly getCurrentFilePath: GetCurrentFilePathFn;
  },
): Promise<void> {
  /**
   * Currently-open file path, or null when no document is loaded.
   */
  const path = getCurrentFilePath();
  if (path === null)
    return;
  /**
   * Cursor position at request time; used later to drop responses whose cursor has since moved.
   */
  const requestPos = editorPane.getCursorPosition();
  if (requestPos === null)
    return;

  try {
    /**
     * Completion items returned by the LSP; destructured so the response shape stays narrow.
     */
    const { items, } = await ws.request({
      type: 'completion',
      path,
      line: requestPos.line,
      character: requestPos.character,
    },);
    /**
     * Cursor position when the response lands; compared against `requestPos` to reject stale responses.
     */
    const responsePos = editorPane.getCursorPosition();
    if (responsePos === null)
      return;
    if (
      (responsePos.line
        !== requestPos
        .line)
      || (responsePos.character
        !== requestPos
        .character)
    ) {
      return;
    }
    /**
     * Caret rectangle in viewport coordinates; popup is anchored to its bottom-left corner.
     */
    const rect = editorPane.getCursorRect();
    if ((items.length
      === 0) || (rect === null))
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
  readonly editorPane: EditorPaneHandle;
  readonly triggerCompletions: () => void;
},): void {
  editorPane.addEventListener(
    'keydown',
    function handleDotKey(event,) {
      /**
       * Narrowed view of the event so `.key` is reachable without `unknown` checks.
       */
      const ke = event as KeyboardEvent;
      if (ke.key
        !== '.')
        return;
      globalThis.setTimeout(
        function deferredTrigger() {
          /**
           * Cursor position after the dot is inserted; null when the editor has lost focus.
           */
          const pos = editorPane.getCursorPosition();
          if (pos === null)
            return;
          /**
           * Editor container element; null while the editor is still mounting.
           */
          const editorEl = editorPane.getEditorElement();
          if (editorEl === null)
            return;
          /**
           * Text of the line the cursor is on; null when the line div has not yet been created.
           */
          const lineText = getLineText({
            editor: editorEl,
            line: pos.line,
          },);
          if (lineText === null)
            return;
          /**
           * The dot has already been inserted; check the position before it.
           */
          const dotIndex = pos.character
            - 1;
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
  readonly completionPopup: CompletionPopupHandle;
  readonly editorPane: EditorPaneHandle;
},): void {
  document.addEventListener(
    'selectionchange',
    function handleSelectionChange() {
      if (!completionPopup.visible)
        return;
      /**
       * Trigger cursor position captured at the last `show()`; null when popup is hidden mid-handler.
       */
      const { shownAt, } = completionPopup;
      if (shownAt === null)
        return;
      /**
       * Cursor position right now; popup hides when this differs from the captured `shownAt`.
       */
      const pos = editorPane.getCursorPosition();
      if (pos === null)
        return;
      if ((pos.line
        !== shownAt
        .line) || (pos.character
          !== shownAt
          .character))
        completionPopup.hide();
    },
  );
}
