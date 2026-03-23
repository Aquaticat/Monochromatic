/**
 * Keyboard navigation handlers for popup overlays.
 *
 * Arrow/Tab/Escape key handling for the completion and references popups.
 * Split from app-keybindings.ts to stay under max-lines.
 */

import type { CompletionPopup, } from './completion-popup.ts';
import type { ReferencesPopup, } from './references-popup.ts';

/**
 * Handles arrow/tab/escape keys when completion popup is visible.
 * Enter dismisses the popup without consuming the event, allowing
 * the browser to insert a newline.
 *
 * @returns true if the event was consumed, false otherwise
 */
export function handleCompletionNav({ event, completionPopup, }: {
  event: KeyboardEvent;
  completionPopup: CompletionPopup;
}): boolean {
  if (event.key === 'ArrowDown') { event.preventDefault(); completionPopup.navigate({ direction: 'down', },); return true; }
  if (event.key === 'ArrowUp') { event.preventDefault(); completionPopup.navigate({ direction: 'up', },); return true; }
  if (event.key === 'Tab') {
    event.preventDefault();
    const text = completionPopup.accept();
    // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand is the only way to insert text preserving the browser undo stack
    if (text !== null) document.execCommand('insertText', false, text,);
    return true;
  }
  if (event.key === 'Enter') { completionPopup.hide(); return false; }
  if (event.key === 'Escape') { event.preventDefault(); completionPopup.hide(); return true; }
  return false;
}

/**
 * Handles arrow/enter/escape keys when references popup is visible.
 *
 * @returns true if the event was consumed, false otherwise
 */
export function handleReferencesNav({ event, referencesPopup, }: {
  event: KeyboardEvent;
  referencesPopup: ReferencesPopup;
}): boolean {
  if (event.key === 'ArrowDown') { event.preventDefault(); referencesPopup.navigate({ direction: 'down', },); return true; }
  if (event.key === 'ArrowUp') { event.preventDefault(); referencesPopup.navigate({ direction: 'up', },); return true; }
  if (event.key === 'Enter') { event.preventDefault(); referencesPopup.accept(); return true; }
  if (event.key === 'Escape') { event.preventDefault(); referencesPopup.hide(); return true; }
  return false;
}
