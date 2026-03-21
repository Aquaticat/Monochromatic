/**
 * Keyboard shortcut handler for the editord client.
 *
 * Binds Ctrl+S (save), Ctrl+Shift+F / Ctrl+Alt+L (format),
 * Ctrl+Space (completions), and completion popup navigation.
 */

import type { CompletionPopup, } from './completion-popup.ts';
import type { HoverPopup, } from './hover-popup.ts';

/**
 * Installs global keyboard shortcuts.
 *
 * @param saveCurrentFile - saves the current file
 *
 * @param formatDocument - formats the current document
 *
 * @param requestCompletions - triggers completion popup
 *
 * @param completionPopup - completion popup for navigation
 *
 * @param hoverPopup - hover popup to dismiss on Escape
 */
export function wireKeybindings({ saveCurrentFile, formatDocument, requestCompletions, completionPopup, hoverPopup, }: {
  saveCurrentFile: () => void;
  formatDocument: () => void;
  requestCompletions: () => void;
  completionPopup: CompletionPopup;
  hoverPopup: HoverPopup;
}): void {
  document.addEventListener('keydown', function handleKeydown(event,) {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      saveCurrentFile();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'F') {
      event.preventDefault();
      formatDocument();
      return;
    }
    if (event.ctrlKey && event.altKey && event.key === 'l') {
      event.preventDefault();
      formatDocument();
      return;
    }
    if (event.ctrlKey && event.key === ' ') {
      event.preventDefault();
      requestCompletions();
      return;
    }
    if (completionPopup.visible && handleCompletionNav({ event, completionPopup, },)) return;
    if (event.key === 'Escape') hoverPopup.hide();
  },);
}

/**
 * Handles arrow/enter/escape keys when completion popup is visible.
 *
 * @returns true if the event was consumed, false otherwise
 */
function handleCompletionNav({ event, completionPopup, }: {
  event: KeyboardEvent;
  completionPopup: CompletionPopup;
}): boolean {
  if (event.key === 'ArrowDown') { event.preventDefault(); completionPopup.navigate({ direction: 'down', },); return true; }
  if (event.key === 'ArrowUp') { event.preventDefault(); completionPopup.navigate({ direction: 'up', },); return true; }
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault();
    const text = completionPopup.accept();
    // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand is the only way to insert text preserving the browser undo stack
    if (text !== null) document.execCommand('insertText', false, text,);
    return true;
  }
  if (event.key === 'Escape') { event.preventDefault(); completionPopup.hide(); return true; }
  return false;
}
