/**
 * Completion popup wiring for the editord client.
 *
 * Handles dot-trigger, Ctrl+Space, and positions the popup at the caret.
 */

import type { CompletionPopup, } from '../completion/completion-popup.ts';
import { l, tagged, } from '../log.ts';
import { getCursorPosition, } from '../position.ts';
import type { EditorWsClient, } from '../ws/client.ts';

/** Tagged logger for completions. */
const completionLog = tagged({ tag: 'completions', l, },);

/**
 * Requests completions from the server and shows the popup.
 *
 * @param ws - WebSocket client
 *
 * @param completionPopup - completion popup to populate
 *
 * @param getEditorElement - returns the contenteditable container
 *
 * @param getCurrentFilePath - returns the currently open file path
 */
export async function requestCompletions({ ws, completionPopup, getEditorElement, getCurrentFilePath, }: {
  ws: EditorWsClient;
  completionPopup: CompletionPopup;
  getEditorElement: () => HTMLElement | null;
  getCurrentFilePath: () => string | null;
}): Promise<void> {
  const path = getCurrentFilePath();
  if (path === null) return;
  const el = getEditorElement();
  if (el === null) return;
  const selection = document.getSelection();
  const pos = getCursorPosition({ editor: el, selection, },);
  if (pos === null) return;

  try {
    const response = await ws.request({ type: 'completion', path, line: pos.line, character: pos.character, },);
    if ('items' in response) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- response narrowed by 'items' check
      const { items, } = response as { items: { label: string; detail: string; insertText: string }[] };
      if (items.length > 0 && selection !== null && selection.rangeCount > 0) {
        const rect = selection.getRangeAt(0,).getBoundingClientRect();
        completionPopup.show({ items, x: rect.left, y: rect.bottom, },);
      }
    }
  }
  catch (error) {
    completionLog.warn(`completion request failed: ${String(error,)}`,);
  }
}

/**
 * Wires dot-trigger for completions on the editor pane.
 *
 * @param editorPane - editor pane to listen for keydown events
 *
 * @param triggerCompletions - callback to invoke when dot is typed
 */
export function wireCompletionTrigger({ editorPane, triggerCompletions, }: {
  editorPane: HTMLElement;
  triggerCompletions: () => void;
}): void {
  editorPane.addEventListener('keydown', function handleDotKey(event,) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- keydown is always a KeyboardEvent
    const ke = event as KeyboardEvent;
    if (ke.key === '.') {
      globalThis.setTimeout(triggerCompletions, 0,);
    }
  },);
}
