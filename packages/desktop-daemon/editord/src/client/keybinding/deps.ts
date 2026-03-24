/**
 * Dependency types for the keybinding handler.
 *
 * Split from app-keybindings.ts to stay under max-lines.
 */

import type { CompletionPopup, } from '../completion/completion-popup.ts';
import type { HoverPopup, } from '../hover/hover-popup.ts';
import type { ReferencesPopup, } from '../references/references-popup.ts';

/**
 * Dependencies injected into the keybinding handler.
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
export type KeybindingDeps = {
  saveCurrentFile: () => void;
  formatDocument: () => void;
  gotoDefinition: () => void;
  deleteCurrentLine: () => void;
  selectAndCopyCurrentLine: () => boolean;
  requestCompletions: () => void;
  expandSelection: () => void;
  shrinkSelection: () => void;
  navigateToRecentFile: (index: number,) => void;
  indentLines: () => void;
  unindentLines: () => void;
  duplicateLineDown: () => void;
  swapLineDown: () => void;
  swapLineUp: () => void;
  openTerminalAtCurrentFile: () => void;
  completionPopup: CompletionPopup;
  referencesPopup: ReferencesPopup;
  hoverPopup: HoverPopup;
};
