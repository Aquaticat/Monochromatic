/**
 * Debounced session state save for editord.
 *
 * Coalesces rapid state changes into a single `localStorage` write
 * after a debounce interval. Also provides an immediate `saveNow`
 * for use in `beforeunload`.
 *
 * Delegates to `createDebounced` from `../debounce.ts` for the timer
 * mechanics. Previously this file had its own `clearTimeout`/`setTimeout`
 * pair with an identical `as unknown as number` workaround. Using the
 * shared primitive keeps the timer logic in one place and lets this
 * module focus on the session-specific concern of capturing state via
 * `getState()` and writing it to `localStorage`.
 */

import { createDebounced, } from '../debounce.ts';
import {
  saveSessionState,
  type SessionState,
} from './state.ts';

/**
 * Minimum interval between debounced saves, in milliseconds.
 */
const SAVE_DEBOUNCE_MS = 300;

/**
 * Creates a debounced save function that coalesces rapid state changes
 * into a single `localStorage` write.
 *
 * @param fsId - filesystem identifier from the server
 *
 * @param rootDir - root directory path from the server
 *
 * @param getState - callback that captures the current UI state
 *
 * @returns debounced save function; also usable synchronously for `beforeunload`
 *
 * @example
 * ```ts
 * const { debouncedSave, saveNow } = createDebouncedSave({
 *   fsId: ws.fsId,
 *   rootDir: ws.rootDir,
 *   getState: collectState,
 * });
 * // On scroll, file switch, etc.:
 * debouncedSave();
 * // On beforeunload:
 * saveNow();
 * ```
 */
export function createDebouncedSave({
  fsId,
  rootDir,
  getState,
}: {
  readonly fsId: string;
  readonly rootDir: string;
  readonly getState: () => SessionState;
},): {
  readonly debouncedSave: () => void;
  readonly saveNow: () => void;
} {
  /**
   * Saves state immediately without debouncing.
   */
  function saveNow(): void {
    saveSessionState({
      fsId,
      rootDir,
      state: getState(),
    },);
  }

  /**
   * Debounced wrapper around `saveNow`; `flush` triggers an immediate save and cancels the pending one.
   */
  const {
    debounced: debouncedSave,
    flush,
  } = createDebounced({
    fn: saveNow,
    delayMs: SAVE_DEBOUNCE_MS,
  },);

  return {
    debouncedSave,
    /**
     * Flushes any pending debounced save and executes immediately.
     */
    saveNow: flush,
  };
}
