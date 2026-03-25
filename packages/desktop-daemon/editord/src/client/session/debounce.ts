/**
 * Debounced session state save for editord.
 *
 * Coalesces rapid state changes into a single `localStorage` write
 * after a debounce interval. Also provides an immediate `saveNow`
 * for use in `beforeunload`.
 */

import {
  saveSessionState,
  type SessionState,
} from './state.ts';

/** Minimum interval between debounced saves, in milliseconds. */
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
  fsId: string;
  rootDir: string;
  getState: () => SessionState;
},): {
  debouncedSave: () => void;
  saveNow: () => void
} {
  let timerId = 0;

  /** Saves state immediately without debouncing. */
  function saveNow(): void {
    clearTimeout(timerId,);
    timerId = 0;
    saveSessionState({
      fsId,
      rootDir,
      state: getState(),
    },);
  }

  /** Schedules a save after the debounce interval. */
  function debouncedSave(): void {
    clearTimeout(timerId,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- setTimeout returns NodeJS.Timeout in Node types but number in browser; we store as number
    timerId = setTimeout(
      saveNow,
      SAVE_DEBOUNCE_MS,
    ) as unknown as number;
  }

  return {
    debouncedSave,
    saveNow,
  };
}
