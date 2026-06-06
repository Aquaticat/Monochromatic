import {
  join,
  relative,
  resolve,
} from 'node:path';
import readdirGlob from 'tiny-readdir-glob';

/**
 * Glob metacharacters that mark where a static prefix ends.
 */
const GLOB_META_CHARS = '*?{[';

/**
 * Returns the index of the first glob metacharacter in `s`, or `-1`
 * when no metacharacters are present. Exported for direct unit testing.
 *
 * Single left-to-right pass over UTF-16 code units. The returned index
 * feeds `slice` in {@link splitGlob}, so positions are measured in code
 * units (via `charAt`), matching `slice`, rather than code points; this
 * keeps astral characters before a metacharacter from shifting the split.
 * O(n) time, O(1) stack, no recursion (stack-safe under engines without
 * tail-call elimination).
 *
 * @param s - candidate glob pattern
 *
 * @returns first metacharacter index
 *
 * @example
 * ```ts
 * firstGlobMetaIndex('src/*.ts');    // 4
 * firstGlobMetaIndex('src/index.ts'); // -1
 * ```
 */
export function firstGlobMetaIndex(s: string,): number {
  for (let cursorIndex = 0; cursorIndex < s
    .length; cursorIndex += 1) {
    if (GLOB_META_CHARS.includes(s.charAt(cursorIndex,),))
      return cursorIndex;
  }
  return -1;
}

/**
 * Splits a glob pattern into a static base directory, a relative glob suffix,
 * and the original static prefix string (for reconstructing output paths).
 * Everything before the first wildcard segment becomes `cwd`;
 * the remainder becomes the pattern passed to the matcher.
 *
 * @param pattern - Glob pattern, absolute or relative (e.g., `/tmp/foo/*.ts` or `./src/**​/*.md`)
 *
 * @returns Tuple of `[resolvedCwd, relativeGlob, originalPrefix]`
 *
 * @example
 * ```ts
 * splitGlob('/tmp/foo/*.ts');
 * // ['/tmp/foo', '*.ts', '/tmp/foo']
 *
 * splitGlob('./src/a/**​/*.md');
 * // ['/abs/path/src/a', '**​/*.md', './src/a']
 * ```
 */
function splitGlob(
  pattern: string,
): readonly [
  cwd: string,
  relativeGlob: string,
  originalPrefix: string,
] {
  /**
   * Position of the first metacharacter
   */
  const metaIndex = firstGlobMetaIndex(pattern,);

  if (metaIndex === (-1)) {
    // No wildcards: treat entire pattern as a literal path
    return [
      resolve(pattern,),
      '',
      pattern,
    ];
  }

  /**
   * Static prefix up to the last `/` before the first metacharacter
   */
  const staticPrefix = pattern.slice(
    0,
    metaIndex,
  );
  /**
   * Index of the last separator in the static prefix
   */
  const lastSep = staticPrefix.lastIndexOf('/',);

  if (lastSep === (-1)) {
    // Metacharacter appears in the first segment; cwd is the current directory
    return [
      resolve('.',),
      pattern,
      '.',
    ];
  }

  /**
   * Original prefix as written in the pattern (preserves `./` or absolute form)
   */
  const originalPrefix = staticPrefix.slice(
    0,
    lastSep,
  );
  return [
    resolve(originalPrefix,),
    pattern.slice(lastSep + 1,),
    originalPrefix,
  ];
}

/**
 * Expands a glob pattern against the filesystem and returns matched file paths.
 * Returned paths preserve the prefix format of the input pattern:
 * relative patterns produce relative paths, absolute patterns produce absolute paths.
 * Uses `tiny-readdir-glob` (backed by zeptomatch) for matching,
 * which always includes dot files without configuration.
 *
 * @param pattern - Glob pattern (e.g., `./packages/*​/src/*.ts`)
 *
 * @returns Array of matched paths with the same prefix style as the input pattern
 *
 * @example
 * ```ts
 * const tsFiles = await expandGlob('./src/**​/*.ts');
 * // ['./src/index.ts', './src/lib/utils.ts']
 * ```
 */
export async function expandGlob(pattern: string,): Promise<readonly string[]> {
  /**
   * Triple from {@link splitGlob}: matcher cwd, glob suffix, and originally-typed prefix.
   */
  const [cwd, relativeGlob, originalPrefix,] = splitGlob(pattern,);

  if (relativeGlob === '')
    return [cwd,];

  /**
   * Files matched by the glob suffix under `cwd`; only the `files` field is consumed.
   */
  const { files, } = await readdirGlob(
    relativeGlob,
    { cwd, },
  );

  // Reconstruct paths using the original prefix to preserve relative/absolute form.
  // Use string concatenation instead of `join()` to preserve `./` prefixes
  // that `join()` would normalize away (e.g., `./.agents` -> `.agents`).
  return files.map(function toOriginalForm(absolutePath: string,): string {
    /**
     * Path relative to the resolved cwd
     */
    const relPath = relative(
      cwd,
      absolutePath,
    );
    /**
     * Separator between prefix and relative path
     */
    const sep = originalPrefix.endsWith('/',) ? '' : '/';
    return `${originalPrefix}${sep}${relPath}`;
  },);
}

/**
 * Returns static directory that should be watched for a glob pattern.
 *
 * @param pattern - Glob pattern tracked during config execution.
 *
 * @returns Absolute directory whose entries can change the glob result.
 *
 * @example
 * ```ts
 * const dir = globWatchDirectory('./src/*.ts');
 * ```
 */
export function globWatchDirectory(pattern: string,): string {
  /**
   * Static matcher directory from the glob split.
   */
  const [cwd,] = splitGlob(pattern,);
  return cwd;
}

/**
 * Extracts wildcard segments from a source path using the source glob pattern,
 * then substitutes them into the destination glob pattern.
 *
 * Each `*` in the source pattern captures one path segment value; those captured
 * values are inserted positionally into the `*` slots of the dest pattern.
 *
 * @param sourcePattern - Glob pattern used to match the source (e.g., `packages/*​/src/*.ts`)
 *
 * @param destPattern - Glob pattern for the destination (e.g., `temp/*​/src/*.ts`)
 *
 * @param sourcePath - Concrete path that matched sourcePattern
 *
 * @returns Concrete destination path with wildcards filled in
 *
 * @throws When wildcard counts don't match between source and dest patterns
 *
 * @example
 * ```ts
 * mirrorGlobPath({
 *   sourcePattern: 'packages/*​/src/*.ts',
 *   destPattern: 'temp/*​/src/*.ts',
 *   sourcePath: 'packages/foo/src/index.ts',
 * });
 * // 'temp/foo/src/index.ts'
 * ```
 */
export function mirrorGlobPath(
  {
    sourcePattern,
    destPattern,
    sourcePath,
  }: {
    readonly sourcePattern: string;
    readonly destPattern: string;
    readonly sourcePath: string;
  },
): string {
  /**
   * Segments of the source pattern split by `*`
   */
  const sourceParts = sourcePattern.split('*',);
  /**
   * Segments of the dest pattern split by `*`
   */
  const destParts = destPattern.split('*',);

  /**
   * Number of wildcards in source vs dest must match for positional substitution
   */
  const sourceWildcardCount = sourceParts.length
    - 1;
  /**
   * Wildcard count on the destination side; compared with source to detect mismatches.
   */
  const destWildcardCount = destParts.length
    - 1;
  if (sourceWildcardCount !== destWildcardCount) {
    throw new Error(
      `Wildcard count mismatch: source "${sourcePattern}" has ${
        String(sourceWildcardCount,)
      }`
        + ` but dest "${destPattern}" has ${String(destWildcardCount,)}`,
    );
  }

  /**
   * Walks the source path, peeling off fixed prefixes and capturing each wildcard segment.
   * Wrapped in a named-function IIFE so the loop-mutated `remainder` lives inside the helper.
   */
  const captured: readonly string[] = (function captureSegments(): readonly string[] {
    /**
     * Wildcard captures appended in source-pattern order.
     */
    const acc: string[] = [];
    /**
     * Unconsumed tail of the source path; shrinks as fixed prefixes get peeled off each iteration.
     */
    let remainder = sourcePath;
    for (let partIndex = 0; partIndex < sourceParts
      .length; partIndex++) {
      /**
       * Fixed text before (or after) the current wildcard
       */
      const fixedPart = sourceParts[partIndex];
      if (fixedPart === undefined)
        break;
      if (!remainder.startsWith(fixedPart,)) {
        throw new Error(
          `Source path "${sourcePath}" does not match pattern "${sourcePattern}" at segment "${fixedPart}"`,
        );
      }
      remainder = remainder.slice(fixedPart.length,);

      if (partIndex < sourceWildcardCount) {
        /**
         * Position of the next fixed segment, marking the end of this wildcard capture
         */
        const nextFixed = sourceParts[partIndex + 1]
          ?? '';
        /**
         * Index in `remainder` where the next fixed segment begins, or end-of-string when none remains.
         */
        const nextFixedPos = (nextFixed === '')
          ? remainder.length
          : remainder.indexOf(nextFixed,);
        if (nextFixedPos === (-1)) {
          throw new Error(
            `Source path "${sourcePath}" does not match pattern "${sourcePattern}"`,
          );
        }
        acc.push(remainder.slice(
          0,
          nextFixedPos,
        ),);
        remainder = remainder.slice(nextFixedPos,);
      }
    }
    return acc;
  })();

  /**
   * Reconstructed destination path with wildcards replaced by captured values
   */
  const result = destParts.flatMap(function appendDestSegment(
    part,
    destIndex,
  ): readonly string[] {
    /**
     * Raw fixed text for this position; coalesce missing entries to empty for safe joining.
     */
    const fixed = part ?? '';
    if (destIndex < destWildcardCount) {
      return [
        fixed,
        captured[destIndex]
          ?? '',
      ];
    }
    return [fixed,];
  },);
  return result.join('',);
}
