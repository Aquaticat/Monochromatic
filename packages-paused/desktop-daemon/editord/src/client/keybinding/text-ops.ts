/**
 * Text manipulation keybinding handlers for the editord client.
 *
 * Handles undo, redo, delete line, copy line, duplicate,
 * and swap line up/down shortcuts. Extracted from app-keybindings.ts
 * to keep files under max-lines.
 */

import type { KeybindingDeps, } from './deps.ts';

/**
 * Deps subset for text manipulation handlers.
 */
type TextOpsDeps = Pick<KeybindingDeps,
  'deleteCurrentLine' | 'selectAndCopyCurrentLine' | 'duplicateLineDown' | 'swapLineDown'
    | 'swapLineUp'>;

/**
 * Handles text manipulation keybindings.
 *
 * @param event - keyboard event to inspect
 *
 * @param deps - text manipulation action callbacks
 *
 * @returns true if the event was handled and should not propagate further
 *
 * @example
 * ```ts
 * const result = handleTextEditKey({ event: keyboardEvent, deps: function handleDeps() { l.info("done"); }, });
 * ```
 */
export function handleTextEditKey({
  event,
  deps,
}: {
  readonly event: KeyboardEvent;
  readonly deps: TextOpsDeps;
},): boolean {
  if ((event.ctrlKey
    || event
    .metaKey) && (!event.shiftKey)
    && (event.key
      === 'z')) {
    event.preventDefault();
    // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand('undo') is the only way to trigger the browser's native undo stack in contenteditable
    document.execCommand(
      'undo',
      false,
    );
    return true;
  }
  if ((event.ctrlKey
    || event
    .metaKey) && event
    .shiftKey
    && (event.key
      === 'Z')) {
    event.preventDefault();
    // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand('redo') is the only way to trigger the browser's native redo stack in contenteditable
    document.execCommand(
      'redo',
      false,
    );
    return true;
  }
  if ((event.ctrlKey
    || event
    .metaKey) && (event.key
      === 'y')) {
    event.preventDefault();
    deps.deleteCurrentLine();
    return true;
  }
  /**
   * Without combined condition: no-lonely-if lint error for nested if without else.
   */
  if ((event.ctrlKey
    || event
    .metaKey)
    && (!event.shiftKey)
    && (event.key
      === 'c')
    && deps
    .selectAndCopyCurrentLine())
  {
    event.preventDefault();
    return true;
  }
  if ((event.ctrlKey
    || event
    .metaKey) && (!event.shiftKey)
    && (event.key
      === 'd')) {
    event.preventDefault();
    deps.duplicateLineDown();
    return true;
  }
  if ((event.ctrlKey
    || event
    .metaKey) && event
    .shiftKey
    && (event.key
      === 'ArrowDown')) {
    event.preventDefault();
    deps.swapLineDown();
    return true;
  }
  if ((event.ctrlKey
    || event
    .metaKey) && event
    .shiftKey
    && (event.key
      === 'ArrowUp')) {
    event.preventDefault();
    deps.swapLineUp();
    return true;
  }
  return false;
}
