/**
 * Fullscreen and Keyboard Lock API integration for editord.
 *
 * Adds a floating action button (FAB) at the bottom-left corner that
 * enters fullscreen and locks the keyboard to capture browser-reserved
 * shortcuts like Ctrl+W. The FAB hides while fullscreen is active and
 * reappears when the user exits fullscreen (Escape / F11).
 *
 * The Keyboard Lock API only works while the document is in fullscreen
 * mode; exiting fullscreen automatically releases the lock.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/lock
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen
 */

import { l, tagged, } from './log.ts';

/** Tagged logger for fullscreen module. */
const fsLog = tagged({ tag: 'fullscreen', l, },);

//region Keyboard Lock API type augmentation -- not yet in lib.dom.d.ts

/** Keyboard Lock API surface on the Keyboard interface. */
type KeyboardWithLock = {
  lock: (keyCodes?: string[]) => Promise<void>;
  unlock: () => void;
};

/** Navigator with optional Keyboard Lock API support. */
type NavigatorWithKeyboard = Navigator & {
  keyboard?: KeyboardWithLock;
};

//endregion

/**
 * Key codes to capture via the Keyboard Lock API.
 * These are physical key codes (KeyboardEvent.code values) that the browser
 * would normally intercept for its own shortcuts.
 *
 * @example
 * ```ts
 * // Ctrl+W (close tab) becomes available to the app
 * LOCKED_KEY_CODES = ['KeyW']
 * ```
 */
const LOCKED_KEY_CODES = [
  'KeyW',
];

/**
 * Requests keyboard lock for the configured key codes.
 * Silently succeeds when the Keyboard Lock API is unavailable.
 */
async function lockKeyboard(): Promise<void> {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- type augmentation for Keyboard Lock API not in lib.dom.d.ts
  const nav = navigator as NavigatorWithKeyboard;
  if (nav.keyboard === undefined) {
    fsLog.info('Keyboard Lock API not available',);
    return;
  }
  try {
    await nav.keyboard.lock(LOCKED_KEY_CODES,);
    fsLog.info(`keyboard locked for: ${LOCKED_KEY_CODES.join(', ',)}`,);
  }
  catch (error) {
    fsLog.error(`keyboard lock failed: ${String(error,)}`,);
  }
}

/**
 * Requests fullscreen on the document element.
 * On success, locks the keyboard to capture browser-reserved shortcuts.
 *
 * Must be called from a user gesture (click, keydown) to satisfy
 * the browser's transient activation requirement.
 */
async function enterFullscreenAndLock(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen();
    fsLog.info('entered fullscreen',);
    await lockKeyboard();
  }
  catch (error) {
    fsLog.error(`fullscreen request failed: ${String(error,)}`,);
  }
}

/**
 * Fullscreen expand icon as inline SVG.
 * Four outward-pointing arrows representing the fullscreen action.
 */
const FULLSCREEN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;

/**
 * Creates the fullscreen FAB and appends it to the app container.
 * The button enters fullscreen + keyboard lock on click, hides while
 * fullscreen is active, and reappears when fullscreen is exited.
 *
 * @param appElement - root app container to append the FAB to
 */
export function wireFullscreen({ appElement, }: { appElement: HTMLElement }): void {
  const fab = document.createElement('button',);
  fab.type = 'button';
  fab.innerHTML = FULLSCREEN_ICON_SVG;
  fab.title = 'Enter fullscreen (enables Ctrl+W)';
  fab.style.position = 'fixed';
  fab.style.insetBlockEnd = '1rem';
  fab.style.insetInlineStart = '1rem';
  fab.style.zIndex = '9999';
  fab.style.display = 'flex';
  fab.style.alignItems = 'center';
  fab.style.justifyContent = 'center';
  fab.style.inlineSize = '2.5rem';
  fab.style.blockSize = '2.5rem';
  fab.style.borderRadius = '50%';
  fab.style.border = 'none';
  fab.style.backgroundColor = 'var(--gutter-fg)';
  fab.style.color = 'var(--bg)';
  fab.style.cursor = 'pointer';
  fab.style.opacity = '0.6';
  fab.style.transition = 'opacity 0.15s';

  fab.addEventListener('pointerenter', function handleEnter(): void { fab.style.opacity = '1'; },);
  fab.addEventListener('pointerleave', function handleLeave(): void { fab.style.opacity = '0.6'; },);

  fab.addEventListener('click', function handleFabClick(): void {
    void enterFullscreenAndLock();
  },);

  appElement.append(fab,);

  document.addEventListener('fullscreenchange', function handleFullscreenChange(): void {
    if (document.fullscreenElement !== null) {
      fsLog.info('fullscreen active',);
      fab.style.display = 'none';
      void lockKeyboard();
    }
    else {
      fsLog.info('fullscreen exited',);
      fab.style.display = 'flex';
    }
  },);
}
