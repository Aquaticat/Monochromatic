/**
 * Dependency types for the keybinding handler.
 *
 * Split from app-keybindings.ts to stay under max-lines.
 */

import type {
  CompletionPopupHandle,
  HoverPopupHandle,
  ReferencesPopupHandle,
} from '../app/types.ts';

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
 * @param renameAtCursor - initiates a rename at the current cursor position
 *
 * @param hoverPopup - hover popup to dismiss on Escape
 */
export type KeybindingDeps = {
  readonly saveCurrentFile: () => void;
  readonly formatDocument: () => void;
  readonly gotoDefinition: () => void;
  readonly renameAtCursor: () => void;
  readonly deleteCurrentLine: () => void;
  readonly selectAndCopyCurrentLine: () => boolean;
  readonly requestCompletions: () => void;
  readonly expandSelection: () => void;
  readonly shrinkSelection: () => void;
  readonly navigateToRecentFile: (index: number,) => void;
  readonly indentLines: () => void;
  readonly unindentLines: () => void;
  readonly duplicateLineDown: () => void;
  readonly swapLineDown: () => void;
  readonly swapLineUp: () => void;
  readonly openTerminalAtCurrentFile: () => void;
  readonly completionPopup: CompletionPopupHandle;
  readonly referencesPopup: ReferencesPopupHandle;
  readonly hoverPopup: HoverPopupHandle;
};
