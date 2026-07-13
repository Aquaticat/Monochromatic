/**
 * Bounded cache lookup for TypeScript semantic bridge.
 *
 * @module
 */

import {
  isAbsolute,
  relative,
  sep,
} from 'node:path';

/**
 * Bounded semantic bridge cache counts for lifecycle verification.
 *
 * @example
 * ```ts
 * const stats: SemanticBridgeCacheStats = {
 *   overlayCount: 1,
 *   projectRootCount: 1,
 * };
 * ```
 */
export type SemanticBridgeCacheStats = {
  readonly overlayCount: number;
  readonly projectRootCount: number;
};

/* oxlint-disable no-restricted-syntax/no-nullish-union -- Map lookup requires undefined fallback sentinel. */
/**
 * Finds deepest cached configured-project root containing source file.
 *
 * @param fileName - Canonical absolute source path.
 *
 * @param projectByRoot - Configured project paths keyed by root directory.
 *
 * @returns configured project path or discovery sentinel.
 *
 * @example
 * ```ts
 * cachedProjectForFile({ fileName, projectByRoot });
 * ```
 */
export function cachedProjectForFile({
  fileName,
  projectByRoot,
}: {
  readonly fileName: string;
  readonly projectByRoot: ReadonlyMap<string, string>;
}): string | undefined {
  return [...projectByRoot.entries(),]
    .filter(function containsFile([root,],): boolean {
      /**
       * Relative path from candidate project root to source.
       */
      const relativePath = relative(
        root,
        fileName,
      );
      return (relativePath === '')
        || ((!isAbsolute(relativePath,))
          && (relativePath !== '..')
          && (!relativePath.startsWith(`..${sep}`,)));
    },)
    .toSorted(function deepestRootFirst(
      [left,],
      [right,],
    ): number {
      return right.length - left.length;
    },)
    .at(0,)
    ?.at(1,);
}
/* oxlint-enable no-restricted-syntax/no-nullish-union */
