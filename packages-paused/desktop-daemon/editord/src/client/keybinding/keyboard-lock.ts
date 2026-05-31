/**
 * Keyboard Lock API integration for fullscreen mode.
 *
 * Captures browser-reserved shortcuts like Ctrl+W when
 * the document is in fullscreen mode.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/lock
 */

import {
  l,
  tagged,
} from '../log.ts';

/**
 * Tagged logger for keyboard lock.
 */
const lockLog = tagged({
  tag: 'keyboard-lock',
  l,
},);

//region Keyboard Lock API type augmentation (not yet in lib.dom.d.ts)

/**
 * Keyboard Lock API surface on the Keyboard interface.
 */
type KeyboardWithLock = {
  readonly lock: (keyCodes?: readonly string[],) => Promise<void>;
  readonly unlock: () => void;
};

/**
 * Navigator with optional Keyboard Lock API support.
 */
type NavigatorWithKeyboard = Navigator & {
  readonly keyboard?: KeyboardWithLock;
};

//endregion Keyboard Lock API type augmentation

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
 *
 * @example
 * ```ts
 * await lockKeyboard();
 * ```
 */
export async function lockKeyboard(): Promise<void> {
  /**
   * Navigator augmented with the Keyboard Lock API; missing in lib.dom.d.ts so cast locally.
   */
  const nav = navigator as NavigatorWithKeyboard;
  if (nav.keyboard
    === undefined) {
    lockLog.info('Keyboard Lock API not available',);
    return;
  }
  try {
    await nav.keyboard
      .lock(LOCKED_KEY_CODES,);
    lockLog.info(`keyboard locked for: ${LOCKED_KEY_CODES.join(', ',)}`,);
  }
  catch (error) {
    lockLog.error(`keyboard lock failed: ${String(error,)}`,);
  }
}

/**
 * Requests fullscreen on the document element.
 * On success, locks the keyboard to capture browser-reserved shortcuts.
 *
 * Must be called from a user gesture (click, keydown) to satisfy
 * the browser's transient activation requirement.
 *
 * @example
 * ```ts
 * await enterFullscreenAndLock();
 * ```
 */
export async function enterFullscreenAndLock(): Promise<void> {
  try {
    await document.documentElement
      .requestFullscreen();
    lockLog.info('entered fullscreen',);
    await lockKeyboard();
  }
  catch (error) {
    lockLog.error(`fullscreen request failed: ${String(error,)}`,);
  }
}
