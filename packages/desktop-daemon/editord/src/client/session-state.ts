/**
 * Session state persistence for editord.
 *
 * Saves and restores UI state (open file, cursor position, scroll offset,
 * expanded directories) to `localStorage`. State is keyed by a combination
 * of the server's filesystem identifier and root directory, so different
 * machines or volumes serving the same path never collide.
 */

import { l as rootLogger, tagged, } from './log.ts';

/** Tagged logger for session state operations. */
const l = tagged({ tag: 'session', l: rootLogger, },);

/** Persisted UI state for a single editord session. */
export type SessionState = {
  /** Absolute path of the currently open file, or null if none. */
  filePath: string | null;
  /** Absolute paths of all expanded directories in the file tree. */
  expandedDirs: string[];
  /** 0-based cursor position in the editor. */
  cursor: { line: number; character: number };
  /** Vertical scroll offset of the editor pane in pixels. */
  scrollTop: number;
};

/** Minimum interval between debounced saves, in milliseconds. */
const SAVE_DEBOUNCE_MS = 300;

/**
 * Builds the `localStorage` key for a given server identity.
 *
 * @param fsId - filesystem identifier from the server
 *
 * @param rootDir - root directory path from the server
 *
 * @returns scoped localStorage key
 */
function storageKey({ fsId, rootDir, }: { fsId: string; rootDir: string }): string {
  return `editord:${fsId}:${rootDir}`;
}

/**
 * Saves session state to `localStorage`.
 *
 * @param fsId - filesystem identifier from the server
 *
 * @param rootDir - root directory path from the server
 *
 * @param state - UI state to persist
 */
export function saveSessionState({ fsId, rootDir, state, }: {
  fsId: string;
  rootDir: string;
  state: SessionState;
}): void {
  try {
    const key = storageKey({ fsId, rootDir, },);
    localStorage.setItem(key, JSON.stringify(state,),);
  }
  catch (error) {
    l.error(`failed to save session state: ${String(error,)}`,);
  }
}

/**
 * Restores session state from `localStorage`.
 *
 * @param fsId - filesystem identifier from the server
 *
 * @param rootDir - root directory path from the server
 *
 * @returns saved state, or null if none exists or parsing fails
 */
export function restoreSessionState({ fsId, rootDir, }: {
  fsId: string;
  rootDir: string;
}): SessionState | null {
  try {
    const key = storageKey({ fsId, rootDir, },);
    const raw = localStorage.getItem(key,);
    if (raw === null) return null;
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; shape validated by caller usage
    return JSON.parse(raw,) as SessionState;
  }
  catch (error) {
    l.error(`failed to restore session state: ${String(error,)}`,);
    return null;
  }
}

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
export function createDebouncedSave({ fsId, rootDir, getState, }: {
  fsId: string;
  rootDir: string;
  getState: () => SessionState;
}): { debouncedSave: () => void; saveNow: () => void } {
  let timerId = 0;

  /** Saves state immediately without debouncing. */
  function saveNow(): void {
    clearTimeout(timerId,);
    timerId = 0;
    saveSessionState({ fsId, rootDir, state: getState(), },);
  }

  /** Schedules a save after the debounce interval. */
  function debouncedSave(): void {
    clearTimeout(timerId,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- setTimeout returns NodeJS.Timeout in Node types but number in browser; we store as number
    timerId = setTimeout(saveNow, SAVE_DEBOUNCE_MS,) as unknown as number;
  }

  return { debouncedSave, saveNow, };
}
