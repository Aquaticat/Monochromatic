/**
 * Session state persistence for editord.
 *
 * Saves and restores UI state (open file, cursor position, scroll offset,
 * expanded directories) to `localStorage`. State is keyed by a combination
 * of the server's filesystem identifier and root directory, so different
 * machines or volumes serving the same path never collide.
 */

import {
  l as rootLogger,
  tagged,
} from '../log.ts';

/**
 * Tagged logger for session state operations.
 */
const l = tagged({
  tag: 'session',
  l: rootLogger,
},);

/**
 * Persisted UI state for a single editord session.
 */
export type SessionState = {
  /**
   * Absolute path of the currently open file, or null if none.
   */
  readonly filePath: string | null;
  /**
   * Absolute paths of all expanded directories in the file tree.
   */
  readonly expandedDirs: readonly string[];
  /**
   * 0-based cursor position in the editor.
   */
  readonly cursor: {
    readonly line: number;
    readonly character: number;
  };
  /**
   * Vertical scroll offset of the editor pane in pixels.
   */
  readonly scrollTop: number;
  /**
   * Recently opened file paths, index 0 = most recent. May be absent in older saved state.
   */
  readonly recentFiles?: readonly string[];
};

/**
 * Builds the `localStorage` key for a given server identity.
 *
 * @param fsId - filesystem identifier from the server
 *
 * @param rootDir - root directory path from the server
 *
 * @returns scoped localStorage key
 */
function storageKey({
  fsId,
  rootDir,
}: {
  readonly fsId: string;
  readonly rootDir: string;
},): string {
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
 *
 * @example
 * ```ts
 * saveSessionState({ fsId: 'dev-sda1', rootDir: '/home/user/project', state: sessionState, });
 * ```
 */
export function saveSessionState({
  fsId,
  rootDir,
  state,
}: {
  readonly fsId: string;
  readonly rootDir: string;
  readonly state: SessionState;
},): void {
  try {
    /**
     * Composite localStorage key keyed on filesystem id + root dir.
     */
    const key = storageKey({
      fsId,
      rootDir,
    },);
    localStorage.setItem(
      key,
      JSON.stringify(state,),
    );
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
 *
 * @example
 * ```ts
 * const result = restoreSessionState({ fsId: 'dev-sda1', rootDir: '/home/user/project', });
 * ```
 */
export function restoreSessionState({
  fsId,
  rootDir,
}: {
  readonly fsId: string;
  readonly rootDir: string;
},): SessionState | null {
  try {
    /**
     * Composite localStorage key keyed on filesystem id + root dir.
     */
    const key = storageKey({
      fsId,
      rootDir,
    },);
    /**
     * Raw JSON string; null indicates no saved state for this key.
     */
    const raw = localStorage.getItem(key,);
    if (raw === null)
      return null;
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; shape validated by caller usage
    return JSON.parse(raw,) as SessionState;
  }
  catch (error) {
    l.error(`failed to restore session state: ${String(error,)}`,);
    return null;
  }
}
