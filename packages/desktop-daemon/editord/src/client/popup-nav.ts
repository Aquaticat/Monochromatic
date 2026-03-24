/**
 * Keyboard navigation handlers for popup overlays.
 *
 * Generic popup nav handler with per-popup configuration.
 * Split from app-keybindings.ts to stay under max-lines.
 */

import type { CompletionPopup, } from './completion/completion-popup.ts';
import type { ReferencesPopup, } from './references/references-popup.ts';

/** Popup that supports keyboard navigation. */
type NavigablePopup = {
  navigate: (opts: { direction: 'up' | 'down'; },) => void;
  hide: () => void;
};

/** Key action for a navigable popup. */
type PopupKeyAction =
  | { action: 'navigate'; direction: 'up' | 'down'; }
  | { action: 'accept'; handler: () => void; }
  | { action: 'dismiss'; consumeEvent: boolean; };

/**
 * Maps a key to an action for a navigable popup.
 *
 * @param keyMap - mapping from key name to action
 */
type PopupKeyMap = Record<string, PopupKeyAction>;

/**
 * Generic popup keyboard navigation handler.
 *
 * @param event - keyboard event
 *
 * @param popup - navigable popup instance
 *
 * @param keyMap - key-to-action mapping
 *
 * @returns true if the event was consumed, false otherwise
 */
function handlePopupNav({ event, popup, keyMap, }: {
  event: KeyboardEvent;
  popup: NavigablePopup;
  keyMap: PopupKeyMap;
},): boolean {
  const entry = keyMap[event.key];
  if (entry === undefined)
    return false;
  if (entry.action === 'navigate') {
    event.preventDefault();
    popup.navigate({ direction: entry.direction, },);
    return true;
  }
  if (entry.action === 'accept') {
    event.preventDefault();
    entry.handler();
    return true;
  }
  // Only 'dismiss' remains after navigate/accept branches
  if (entry.consumeEvent)
    event.preventDefault();
  popup.hide();
  return entry.consumeEvent;
}

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
},): boolean {
  /** Tab accepts the selected completion and inserts its text. */
  function acceptCompletion(): void {
    const text = completionPopup.accept();
    // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand is the only way to insert text preserving the browser undo stack
    if (text !== null)
      document.execCommand('insertText', false, text,);
  }
  return handlePopupNav({
    event,
    popup: completionPopup,
    keyMap: {
      ArrowDown: { action: 'navigate', direction: 'down', },
      ArrowUp: { action: 'navigate', direction: 'up', },
      Tab: { action: 'accept', handler: acceptCompletion, },
      Enter: { action: 'dismiss', consumeEvent: false, },
      Escape: { action: 'dismiss', consumeEvent: true, },
    },
  },);
}

/**
 * Handles arrow/enter/escape keys when references popup is visible.
 *
 * @returns true if the event was consumed, false otherwise
 */
export function handleReferencesNav({ event, referencesPopup, }: {
  event: KeyboardEvent;
  referencesPopup: ReferencesPopup;
},): boolean {
  return handlePopupNav({
    event,
    popup: referencesPopup,
    keyMap: {
      ArrowDown: { action: 'navigate', direction: 'down', },
      ArrowUp: { action: 'navigate', direction: 'up', },
      Enter: { action: 'accept', handler: function accept() {
        referencesPopup.accept();
      }, },
      Escape: { action: 'dismiss', consumeEvent: true, },
    },
  },);
}
