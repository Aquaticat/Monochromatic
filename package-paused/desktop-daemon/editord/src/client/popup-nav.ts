/**
 * Keyboard navigation handlers for popup overlays.
 *
 * Generic popup nav handler with per-popup configuration.
 * Split from app-keybindings.ts to stay under max-lines.
 */

/**
 * Popup that supports keyboard navigation.
 */
type NavigablePopup = {
  readonly navigate: (opts: { readonly direction: 'up' | 'down'; },) => void;
  readonly hide: () => void;
};

/**
 * Completion popup surface needed by keyboard navigation.
 */
type CompletionNavPopup = NavigablePopup & {
  readonly accept: () => string | null;
};

/**
 * References popup surface needed by keyboard navigation.
 */
type ReferencesNavPopup = NavigablePopup & {
  readonly accept: () => void;
};

/**
 * Key action for a navigable popup.
 */
type PopupKeyAction =
  | {
    readonly action: 'navigate';
    readonly direction: 'up' | 'down';
  }
  | {
    readonly action: 'accept';
    readonly handler: () => void;
  }
  | {
    readonly action: 'dismiss';
    readonly consumeEvent: boolean;
  };

/**
 * Maps a key to an action for a navigable popup.
 *
 * @param keyMap - mapping from key name to action
 */
type PopupKeyMap = Readonly<Record<string, PopupKeyAction>>;

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
function handlePopupNav({
  event,
  popup,
  keyMap,
}: {
  readonly event: KeyboardEvent;
  readonly popup: NavigablePopup;
  readonly keyMap: PopupKeyMap;
},): boolean {
  /**
   * Action descriptor for the pressed key; absent means we don't handle this key.
   */
  const entry = keyMap[event.key];
  if (entry === undefined)
    return false;
  if (entry.action
    === 'navigate') {
    event.preventDefault();
    popup.navigate({ direction: entry.direction, },);
    return true;
  }
  if (entry.action
    === 'accept') {
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
 *
 * @example
 * ```ts
 * const result = handleCompletionNav();
 * ```
 */
export function handleCompletionNav({
  event,
  completionPopup,
}: {
  readonly event: KeyboardEvent;
  readonly completionPopup: CompletionNavPopup;
},): boolean {
  /**
   * Tab accepts the selected completion and inserts its text.
   */
  function acceptCompletion(): void {
    /**
     * Selected completion text; `null` when nothing is currently highlighted.
     */
    const text = completionPopup.accept();
    if (text !== null) {
      // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand is the only way to insert text preserving the browser undo stack
      document.execCommand(
        'insertText',
        false,
        text,
      );
    }
  }
  return handlePopupNav({
    event,
    popup: completionPopup,
    keyMap: {
      ArrowDown: {
        action: 'navigate',
        direction: 'down',
      },
      ArrowUp: {
        action: 'navigate',
        direction: 'up',
      },
      Tab: {
        action: 'accept',
        handler: acceptCompletion,
      },
      Enter: {
        action: 'dismiss',
        consumeEvent: false,
      },
      Escape: {
        action: 'dismiss',
        consumeEvent: true,
      },
    },
  },);
}

/**
 * Handles arrow/enter/escape keys when references popup is visible.
 *
 * @returns true if the event was consumed, false otherwise
 *
 * @example
 * ```ts
 * const result = handleReferencesNav();
 * ```
 */
export function handleReferencesNav({
  event,
  referencesPopup,
}: {
  readonly event: KeyboardEvent;
  readonly referencesPopup: ReferencesNavPopup;
},): boolean {
  return handlePopupNav({
    event,
    popup: referencesPopup,
    keyMap: {
      ArrowDown: {
        action: 'navigate',
        direction: 'down',
      },
      ArrowUp: {
        action: 'navigate',
        direction: 'up',
      },
      Enter: {
        action: 'accept',
        handler: function accept() {
          referencesPopup.accept();
        },
      },
      Escape: {
        action: 'dismiss',
        consumeEvent: true,
      },
    },
  },);
}
