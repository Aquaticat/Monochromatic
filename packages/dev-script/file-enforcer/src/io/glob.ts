import {
  join,
  relative,
  resolve,
} from 'node:path';
import readdirGlob from 'tiny-readdir-glob';

/** Index of the first glob metacharacter in a pattern string */
const GLOB_META = /[*?{[]/;

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
  /** Position of the first metacharacter */
  const metaIndex = pattern.search(GLOB_META,);

  if (metaIndex === -1) {
    // No wildcards -- treat entire pattern as a literal path
    return [
      resolve(pattern,),
      '',
      pattern,
    ];
  }

  /** Static prefix up to the last `/` before the first metacharacter */
  const staticPrefix = pattern.slice(
    0,
    metaIndex,
  );
  /** Index of the last separator in the static prefix */
  const lastSep = staticPrefix.lastIndexOf('/',);

  if (lastSep === -1) {
    // Metacharacter appears in the first segment; cwd is the current directory
    return [
      resolve('.',),
      pattern,
      '.',
    ];
  }

  /** Original prefix as written in the pattern (preserves `./` or absolute form) */
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
 * Returned paths preserve the prefix format of the input pattern --
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
  const [cwd, relativeGlob, originalPrefix,] = splitGlob(pattern,);

  if (relativeGlob === '')
    return [cwd,];

  const { files, } = await readdirGlob(
    relativeGlob,
    { cwd, },
  );

  // Reconstruct paths using the original prefix to preserve relative/absolute form.
  // Use string concatenation instead of `join()` to preserve `./` prefixes
  // that `join()` would normalize away (e.g., `./.agents` -> `.agents`).
  return files.map(function toOriginalForm(absolutePath: string,): string {
    /** Path relative to the resolved cwd */
    const relPath = relative(
      cwd,
      absolutePath,
    );
    /** Separator between prefix and relative path */
    const sep = originalPrefix.endsWith('/',) ? '' : '/';
    return `${originalPrefix}${sep}${relPath}`;
  },);
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
 * mirrorGlobPath('packages/*/src/*.ts', 'temp/*/src/*.ts', 'packages/foo/src/index.ts');
 * // 'temp/foo/src/index.ts'
 * ```
 */
export function mirrorGlobPath(
  sourcePattern: string,
  destPattern: string,
  sourcePath: string,
): string {
  /** Segments of the source pattern split by `*` */
  const sourceParts = sourcePattern.split('*',);
  /** Segments of the dest pattern split by `*` */
  const destParts = destPattern.split('*',);

  /** Number of wildcards in source vs dest must match for positional substitution */
  const sourceWildcardCount = sourceParts.length - 1;
  const destWildcardCount = destParts.length - 1;
  if (sourceWildcardCount !== destWildcardCount) {
    throw new Error(
      `Wildcard count mismatch: source "${sourcePattern}" has ${
        String(sourceWildcardCount,)
      }`
        + ` but dest "${destPattern}" has ${String(destWildcardCount,)}`,
    );
  }

  /** Values captured from each wildcard position in the source path */
  const captured: string[] = [];
  // Walk the source path, peeling off fixed prefixes to isolate wildcard captures --
  // let needed because remainder shrinks with each iteration
  let remainder = sourcePath;
  for (let partIndex = 0; partIndex < sourceParts.length; partIndex++) {
    /** Fixed text before (or after) the current wildcard */
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
      /** Position of the next fixed segment, marking the end of this wildcard capture */
      const nextFixed = sourceParts[partIndex + 1] ?? '';
      const nextFixedPos = nextFixed === ''
        ? remainder.length
        : remainder.indexOf(nextFixed,);
      if (nextFixedPos === -1) {
        throw new Error(
          `Source path "${sourcePath}" does not match pattern "${sourcePattern}"`,
        );
      }
      captured.push(remainder.slice(
        0,
        nextFixedPos,
      ),);
      remainder = remainder.slice(nextFixedPos,);
    }
  }

  /** Reconstructed destination path with wildcards replaced by captured values */
  const result: string[] = [];
  for (let destIndex = 0; destIndex < destParts.length; destIndex++) {
    result.push(destParts[destIndex] ?? '',);
    if (destIndex < destWildcardCount)
      result.push(captured[destIndex] ?? '',);
  }
  return result.join('',);
}
