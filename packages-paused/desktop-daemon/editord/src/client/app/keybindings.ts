/**
 * Keyboard shortcut handler for the editord client.
 *
 * Binds Ctrl+S (save), Ctrl+Shift+F / Ctrl+Alt+L (format),
 * Ctrl+B (go to definition / find references), Shift+F6 (rename),
 * Ctrl+Z (undo),
 * Ctrl+Shift+Z (redo), Ctrl+Y (delete current line),
 * Ctrl+C (copy current line when no selection), Ctrl+Space (completions),
 * Ctrl+W (expand selection), Ctrl+Shift+W (shrink selection),
 * Ctrl+D (duplicate line down), Ctrl+Shift+Down (swap line down),
 * Ctrl+Shift+Up (swap line up), Ctrl+0..9 (navigate to recent file),
 * Alt+F12 (open terminal at current file's directory),
 * Tab (indent), Shift+Tab (unindent), and popup navigation for
 * completions and references.
 */

import type { KeybindingDeps, } from '../keybinding/deps.ts';
import { handleTextEditKey, } from '../keybinding/text-ops.ts';
import {
  handleCompletionNav,
  handleReferencesNav,
} from '../popup-nav.ts';

/**
 * Installs global keyboard shortcuts.
 * See {@link KeybindingDeps} for parameter documentation.
 *
 * @example
 * ```ts
 * wireKeybindings();
 * ```
 */
export function wireKeybindings({
  saveCurrentFile,
  formatDocument,
  gotoDefinition,
  renameAtCursor,
  deleteCurrentLine,
  selectAndCopyCurrentLine,
  requestCompletions,
  expandSelection,
  shrinkSelection,
  navigateToRecentFile,
  indentLines,
  unindentLines,
  duplicateLineDown,
  swapLineDown,
  swapLineUp,
  openTerminalAtCurrentFile,
  completionPopup,
  referencesPopup,
  hoverPopup,
}: KeybindingDeps,): void {
  document.addEventListener(
    'keydown',
    function handleKeydown(event,) {
      if ((event.ctrlKey
        || event
        .metaKey) && (event.key
          === 's')) {
        event.preventDefault();
        saveCurrentFile();
        return;
      }
      if ((event.ctrlKey
        || event
        .metaKey) && event
        .shiftKey
        && (event.key
          === 'F')) {
        event.preventDefault();
        formatDocument();
        return;
      }
      if (event.ctrlKey
        && event
        .altKey
        && (event.key
          === 'l')) {
        event.preventDefault();
        formatDocument();
        return;
      }
      if ((event.ctrlKey
        || event
        .metaKey) && (event.key
          === 'b')) {
        event.preventDefault();
        gotoDefinition();
        return;
      }
      if (event.shiftKey
        && (!event.ctrlKey)
        && (!event.metaKey)
        && (!event.altKey)
        && (event.key
          === 'F6'))
      {
        event.preventDefault();
        renameAtCursor();
        return;
      }
      if (handleTextEditKey({
        event,
        deps: {
          deleteCurrentLine,
          selectAndCopyCurrentLine,
          duplicateLineDown,
          swapLineDown,
          swapLineUp,
        },
      },)) {
        return;
      }
      if (event.ctrlKey
        && (event.key
          === ' ')) {
        event.preventDefault();
        requestCompletions();
        return;
      }
      if ((event.ctrlKey
        || event
        .metaKey) && event
        .shiftKey
        && (event.key
          === 'W')) {
        event.preventDefault();
        shrinkSelection();
        return;
      }
      if ((event.ctrlKey
        || event
        .metaKey) && (!event.shiftKey)
        && (event.key
          === 'w')) {
        event.preventDefault();
        expandSelection();
        return;
      }
      if ((event.ctrlKey
        || event
        .metaKey)
        && (!event.shiftKey)
        && (!event.altKey)
        && (event.key
          >= '0')
        && (event.key
          <= '9'))
      {
        event.preventDefault();
        navigateToRecentFile(Number(event.key,),);
        return;
      }
      if (event.altKey
        && (!event.ctrlKey)
        && (!event.metaKey)
        && (!event.shiftKey)
        && (event.key
          === 'F12'))
      {
        event.preventDefault();
        openTerminalAtCurrentFile();
        return;
      }
      if (referencesPopup.visible
        && handleReferencesNav({
        event,
        referencesPopup,
      },)) {
        return;
      }
      if (completionPopup.visible
        && handleCompletionNav({
        event,
        completionPopup,
      },)) {
        return;
      }
      if ((event.key
        === 'Tab')
        && (!event.ctrlKey)
        && (!event.metaKey)
        && (!event.altKey))
      {
        event.preventDefault();
        if (event.shiftKey)
          unindentLines();
        else
          indentLines();
        return;
      }
      if (event.key
        === 'Escape')
        hoverPopup.hide();
    },
  );
}
