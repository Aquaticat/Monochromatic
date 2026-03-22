/**
 * Keyboard shortcut handler for the editord client.
 *
 * Binds Ctrl+S (save), Ctrl+Shift+F / Ctrl+Alt+L (format),
 * Ctrl+B (go to definition / find references), Ctrl+Z (undo),
 * Ctrl+Shift+Z (redo), Ctrl+Y (delete current line),
 * Ctrl+C (copy current line when no selection), Ctrl+Space (completions),
 * Ctrl+W (expand selection), Ctrl+Shift+W (shrink selection),
 * Ctrl+D (duplicate line down), Ctrl+Shift+Down (swap line down),
 * Ctrl+Shift+Up (swap line up), Ctrl+0..9 (navigate to recent file),
 * Alt+F12 (open terminal at current file's directory),
 * Tab (indent), Shift+Tab (unindent), and popup navigation for
 * completions and references.
 */

import type { CompletionPopup, } from './completion-popup.ts';
import type { HoverPopup, } from './hover-popup.ts';
import type { ReferencesPopup, } from './references-popup.ts';

/**
 * Installs global keyboard shortcuts.
 *
 * @param saveCurrentFile - saves the current file
 *
 * @param formatDocument - formats the current document
 *
 * @param gotoDefinition - navigates to definition or shows references
 *
 * @param deleteCurrentLine - deletes the line at the cursor
 *
 * @param selectAndCopyCurrentLine - selects and copies the current line when no text is selected;
 * returns true if handled, false when the browser should perform the default copy
 *
 * @param requestCompletions - triggers completion popup
 *
 * @param completionPopup - completion popup for navigation
 *
 * @param referencesPopup - references popup for navigation
 *
 * @param expandSelection - expands the selection to the next larger syntactic scope
 *
 * @param shrinkSelection - shrinks the selection back to the previous smaller scope
 *
 * @param navigateToRecentFile - opens a recent file by recency index (0 = current, 9 = oldest)
 *
 * @param indentLines - indents current line or selected lines
 *
 * @param unindentLines - unindents current line or selected lines
 *
 * @param duplicateLineDown - duplicates current line below and moves cursor down
 *
 * @param swapLineDown - swaps current line with next line and moves cursor down
 *
 * @param swapLineUp - swaps current line with previous line and moves cursor up
 *
 * @param openTerminalAtCurrentFile - opens a terminal at the directory of the currently open file,
 * or at the project root when no file is open
 *
 * @param hoverPopup - hover popup to dismiss on Escape
 */
export function wireKeybindings({ saveCurrentFile, formatDocument, gotoDefinition, deleteCurrentLine, selectAndCopyCurrentLine, requestCompletions, expandSelection, shrinkSelection, navigateToRecentFile, indentLines, unindentLines, duplicateLineDown, swapLineDown, swapLineUp, openTerminalAtCurrentFile, completionPopup, referencesPopup, hoverPopup, }: {
  saveCurrentFile: () => void;
  formatDocument: () => void;
  gotoDefinition: () => void;
  deleteCurrentLine: () => void;
  selectAndCopyCurrentLine: () => boolean;
  requestCompletions: () => void;
  expandSelection: () => void;
  shrinkSelection: () => void;
  navigateToRecentFile: (index: number) => void;
  indentLines: () => void;
  unindentLines: () => void;
  duplicateLineDown: () => void;
  swapLineDown: () => void;
  swapLineUp: () => void;
  openTerminalAtCurrentFile: () => void;
  completionPopup: CompletionPopup;
  referencesPopup: ReferencesPopup;
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
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      event.preventDefault();
      gotoDefinition();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === 'z') {
      event.preventDefault();
      // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand('undo') is the only way to trigger the browser's native undo stack in contenteditable
      document.execCommand('undo', false,);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Z') {
      event.preventDefault();
      // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand('redo') is the only way to trigger the browser's native redo stack in contenteditable
      document.execCommand('redo', false,);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
      event.preventDefault();
      deleteCurrentLine();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === 'c') {
      if (selectAndCopyCurrentLine()) {
        event.preventDefault();
        return;
      }
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === 'd') {
      event.preventDefault();
      duplicateLineDown();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowDown') {
      event.preventDefault();
      swapLineDown();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowUp') {
      event.preventDefault();
      swapLineUp();
      return;
    }
    if (event.ctrlKey && event.key === ' ') {
      event.preventDefault();
      requestCompletions();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'W') {
      event.preventDefault();
      shrinkSelection();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === 'w') {
      event.preventDefault();
      expandSelection();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key >= '0' && event.key <= '9') {
      event.preventDefault();
      navigateToRecentFile(Number(event.key,),);
      return;
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key === 'F12') {
      event.preventDefault();
      openTerminalAtCurrentFile();
      return;
    }
    if (referencesPopup.visible && handleReferencesNav({ event, referencesPopup, },)) return;
    if (completionPopup.visible && handleCompletionNav({ event, completionPopup, },)) return;
    if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (event.shiftKey) unindentLines();
      else indentLines();
      return;
    }
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

/**
 * Handles arrow/enter/escape keys when references popup is visible.
 *
 * @returns true if the event was consumed, false otherwise
 */
function handleReferencesNav({ event, referencesPopup, }: {
  event: KeyboardEvent;
  referencesPopup: ReferencesPopup;
}): boolean {
  if (event.key === 'ArrowDown') { event.preventDefault(); referencesPopup.navigate({ direction: 'down', },); return true; }
  if (event.key === 'ArrowUp') { event.preventDefault(); referencesPopup.navigate({ direction: 'up', },); return true; }
  if (event.key === 'Enter') { event.preventDefault(); referencesPopup.accept(); return true; }
  if (event.key === 'Escape') { event.preventDefault(); referencesPopup.hide(); return true; }
  return false;
}
