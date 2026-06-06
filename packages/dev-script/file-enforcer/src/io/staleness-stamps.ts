import { statSync, } from 'node:fs';
import { resolve, } from 'node:path';
import type { TrackedGlob, } from '../tracker.ts';
import { expandGlob, } from './glob.ts';
import {
  ABSENT_FILE_STAMPS,
  type FileStamp,
  type GlobStamp,
} from './staleness-types.ts';

/**
 * Returns unique absolute paths in deterministic order.
 *
 * @param paths - Paths to normalize.
 *
 * @returns Sorted absolute paths without duplicates.
 *
 * @example
 * ```ts
 * const paths = normalizePaths(['./a', './a']);
 * ```
 */
export function normalizePaths(paths: readonly string[],): readonly string[] {
  return [...new Set(paths.map(function toAbsolutePath(path,): string {
    return resolve(path,);
  },),),]
    .toSorted();
}

/**
 * Normalizes tracked glob stamps for persistence.
 *
 * @param globs - Captured glob expansions.
 *
 * @returns Sorted glob stamps with absolute matched paths.
 *
 * @example
 * ```ts
 * const globs = normalizeGlobStamps(capturedGlobs);
 * ```
 */
export function normalizeGlobStamps(globs: readonly TrackedGlob[],): readonly GlobStamp[] {
  return globs
    .map(function normalizeGlob(glob,): GlobStamp {
      return {
        pattern: glob.pattern,
        paths: normalizePaths(glob.paths,),
      };
    },)
    .toSorted(function compareGlobPatterns(
      leftGlob,
      rightGlob,
    ): number {
      return leftGlob
        .pattern
        .localeCompare(rightGlob.pattern,);
    },);
}

/**
 * Stats a file path for manifest validation.
 *
 * @param path - File path to inspect.
 *
 * @returns File metadata, or sentinel when path is absent.
 *
 * @example
 * ```ts
 * const stamp = await readFileStamp('./AGENTS.md');
 * ```
 */
function readFileStamp(path: string,): FileStamp | typeof ABSENT_FILE_STAMPS {
  try {
    /**
     * Filesystem metadata for the path.
     */
    const fileStat = statSync(path,);
    return {
      path: resolve(path,),
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
    };
  }
  catch {
    return ABSENT_FILE_STAMPS;
  }
}

/**
 * Type guard for filtering absent file stamps.
 *
 * @param value - Maybe-present file stamp.
 *
 * @returns Whether value is present.
 *
 * @example
 * ```ts
 * const present = stamps.filter(isPresentFileStamp);
 * ```
 */
function isPresentFileStamp(value: FileStamp | typeof ABSENT_FILE_STAMPS,): value is FileStamp {
  return value !== ABSENT_FILE_STAMPS;
}

/**
 * Reads metadata for every path, returning a sentinel if any path is missing.
 *
 * @param paths - Paths to stat.
 *
 * @returns Sorted metadata list when every path exists.
 *
 * @example
 * ```ts
 * const stamps = await readFileStamps(['./AGENTS.md']);
 * ```
 */
export function readFileStamps(
  paths: readonly string[],
): readonly FileStamp[] | typeof ABSENT_FILE_STAMPS {
  /**
   * Metadata results in input order.
   */
  const stamps = normalizePaths(paths,)
    .map(function readPathStamp(path,): FileStamp | typeof ABSENT_FILE_STAMPS {
      return readFileStamp(path,);
    },);
  /**
   * Present metadata results.
   */
  const presentStamps = stamps.filter(function keepPresentStamp(
    stamp,
  ): stamp is FileStamp {
    return isPresentFileStamp(stamp,);
  },);
  if (presentStamps.length !== stamps.length)
    return ABSENT_FILE_STAMPS;

  return presentStamps.toSorted(function compareStampPaths(
    leftStamp,
    rightStamp,
  ): number {
    return leftStamp
      .path
      .localeCompare(rightStamp.path,);
  },);
}

/**
 * Compares two file metadata entries.
 *
 * @param currentStamp - Current filesystem metadata.
 *
 * @param recordedStamp - Persisted metadata.
 *
 * @returns Whether both entries describe the same path state.
 *
 * @example
 * ```ts
 * const same = fileStampMatches({ currentStamp, recordedStamp });
 * ```
 */
function fileStampMatches(
  {
    currentStamp,
    recordedStamp,
  }: {
    readonly currentStamp: FileStamp;
    readonly recordedStamp: FileStamp;
  },
): boolean {
  if (currentStamp.path !== recordedStamp.path)
    return false;
  if (currentStamp.size !== recordedStamp.size)
    return false;

  return currentStamp.mtimeMs === recordedStamp.mtimeMs;
}

/**
 * Compares current metadata against a persisted metadata list.
 *
 * @param currentStamps - Current filesystem metadata.
 *
 * @param recordedStamps - Persisted metadata.
 *
 * @returns Whether every entry matches.
 *
 * @example
 * ```ts
 * const fresh = fileStampListsMatch({ currentStamps, recordedStamps });
 * ```
 */
export function fileStampListsMatch(
  {
    currentStamps,
    recordedStamps,
  }: {
    readonly currentStamps: readonly FileStamp[];
    readonly recordedStamps: readonly FileStamp[];
  },
): boolean {
  if (currentStamps.length !== recordedStamps.length)
    return false;

  return currentStamps.every(function stampMatches(
    currentStamp,
    stampIndex,
  ): boolean {
    /**
     * Persisted stamp at the same sorted index.
     */
    const recordedStamp = recordedStamps[stampIndex];
    if (recordedStamp === undefined)
      return false;

    return fileStampMatches({
      currentStamp,
      recordedStamp,
    },);
  },);
}

/**
 * Compares current glob expansions against persisted path sets.
 *
 * @param sourceGlobs - Persisted glob expansions.
 *
 * @returns Whether every glob still expands to the same paths.
 *
 * @example
 * ```ts
 * const fresh = await globStampsMatch(sourceGlobs);
 * ```
 */
export async function globStampsMatch(sourceGlobs: readonly GlobStamp[],): Promise<boolean> {
  /**
   * Per-glob freshness checks.
   */
  const checks = await Promise.all(
    sourceGlobs.map(async function globStillMatches(sourceGlob,): Promise<boolean> {
      /**
       * Current matched paths for this glob.
       */
      const currentPaths = normalizePaths(await expandGlob(sourceGlob.pattern,),);
      /**
       * Number of paths currently matched by this glob.
       */
      const currentPathCount = currentPaths.length;
      /**
       * Number of paths recorded in the manifest for this glob.
       */
      const recordedPathCount = sourceGlob
        .paths
        .length;
      if (currentPathCount !== recordedPathCount)
        return false;

      return currentPaths.every(function globPathMatches(
        currentPath,
        pathIndex,
      ): boolean {
        return currentPath === sourceGlob.paths[pathIndex];
      },);
    },),
  );
  return checks.every(function checkPassed(check,): boolean {
    return check;
  },);
}
