/**
 * Ordered tracker for recently opened file paths.
 *
 * Maintains a list of up to 10 paths (indices 0 through 9),
 * where index 0 is the most recently opened file.
 * Pushing a path already in the list promotes it to the front.
 */

import {
  l as rootLogger,
  tagged,
} from './log.ts';

/**
 * Tagged logger for the recent files tracker.
 */
const l = tagged({
  tag: 'recent-files',
  l: rootLogger,
},);

/**
 * Maximum number of recent files to track (indices 0 through 9).
 */
const MAX_RECENT = 10;

/**
 * Mutable ordered list of recent file paths with push-to-front semantics.
 *
 * The `paths` array is exposed read-only; callers restore saved state through
 * `replaceAll` so the tracker keeps ownership of trimming and mutation.
 *
 * @example
 * ```ts
 * const recent = createRecentFiles();
 * recent.push('/src/app.ts');
 * recent.push('/src/index.ts');
 * // recent.paths === ['/src/index.ts', '/src/app.ts']
 * recent.push('/src/app.ts');
 * // recent.paths === ['/src/app.ts', '/src/index.ts']
 * ```
 */
export type RecentFiles = {
  /**
   * Ordered paths array, index 0 is most recent.
   */
  readonly paths: readonly string[];
  /**
   * Adds or promotes a path to position 0, trimming to 10 entries.
   */
  readonly push: (path: string,) => void;
  /**
   * Replaces all tracked paths during session restore, trimming to 10 entries.
   */
  readonly replaceAll: (paths: readonly string[],) => void;
};

/**
 * Creates a recent files tracker with push-to-front semantics.
 *
 * @returns tracker with mutable paths array and push function
 *
 * @example
 * ```ts
 * const result = createRecentFiles();
 * ```
 */
export function createRecentFiles(): RecentFiles {
  /**
   * Backing array for the ordered recent list.
   */
  const paths: string[] = [];

  /**
   * Adds a path to the front of the recent list.
   * If already present, promotes it to position 0.
   * Trims to {@link MAX_RECENT} entries.
   *
   * @param path - absolute file path to record
   */
  function push(path: string,): void {
    /**
     * Position of `path` in the recent list; `-1` means new, `0` means already at front.
     */
    const existing = paths.indexOf(path,);
    if (existing === 0)
      return;
    if (existing > 0) {
      paths.splice(
        existing,
        1,
      );
    }
    paths.unshift(path,);
    if (paths.length
      > MAX_RECENT)
      paths.pop();
    l.info(`pushed ${path} (${String(paths.length,)} tracked)`,);
  }

  /**
   * Replaces the tracked path list while preserving tracker ownership.
   * Saved state is already ordered most-recent-first, so restore keeps that
   * order and trims overlong historical state to the current cap.
   *
   * @param restoredPaths - persisted recent files ordered most-recent-first
   *
   * @example
   * ```ts
   * recent.replaceAll(['/src/app.ts', '/src/index.ts']);
   * ```
   */
  function replaceAll(restoredPaths: readonly string[],): void {
    /**
     * Trimmed restore payload so the variadic splice call receives a named list.
     */
    const trimmedPaths = restoredPaths.slice(
      0,
      MAX_RECENT,
    );
    paths.splice(
      0,
      paths.length,
      ...trimmedPaths,
    );
    l.info(`restored ${String(paths.length,)} recent file(s)`,);
  }

  return {
    /**
     * Exposes ordered recent paths without transferring mutation ownership.
     *
     * @returns readonly view of current recent files
     *
     * @example
     * ```ts
     * const paths = recent.paths;
     * ```
     */
    get paths(): readonly string[] {
      return paths;
    },
    push,
    replaceAll,
  };
}
