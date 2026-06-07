/**
 * Dynamic source-file enumeration for mutation targets.
 *
 * @example
 * ```ts
 * await enumerateSourceFiles({ packageRoot: '/repo/packages/dev-script/file-enforcer' });
 * ```
 */

import { readdir, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  isSafeRelativePath,
  relativePosix,
  sortStrings,
  toPosixPath,
} from './path-utils.ts';
import type {
  SourceExclusion,
  SourceSelection,
  SourceSelectionOptions,
} from './types.ts';

/**
 * Default source directory inside a target package.
 */
const DEFAULT_SRC_DIR = 'src';

/**
 * Reason used for files that match unit, regression, property, or integration tests.
 */
const TEST_FILE_REASON = 'test file';

/**
 * Reason used for TypeScript declaration files.
 */
const DECLARATION_REASON = 'declaration file';

/**
 * Reason used for fixture directories.
 */
const FIXTURE_REASON = 'fixture tree';

/**
 * File suffixes excluded because they are tests rather than mutation targets.
 */
const TEST_SUFFIXES = [
  '.unit.test.ts',
  '.test.ts',
  '.spec.ts',
] as const;

/**
 * Sentinel marking files that remain mutation targets.
 */
const INCLUDED_SOURCE = Symbol('included source');

/**
 * Exclusion reason or inclusion sentinel for source selection.
 */
type ExclusionReason = string | typeof INCLUDED_SOURCE;

/**
 * Returns all files under a directory as absolute paths.
 *
 * @param directory - Directory to walk.
 *
 * @returns Absolute descendant file paths.
 *
 * @example
 * ```ts
 * await walkFiles('/repo/pkg/src');
 * ```
 */
async function walkFiles(directory: string,): Promise<readonly string[]> {
  /**
   * Directory entries immediately under current directory.
   */
  const entries = await readdir(
    directory,
    { withFileTypes: true, },
  );
  /**
   * File lists returned by each child entry.
   */
  const nested = await Promise.all(entries.map(function walkEntry(entry,): Promise<readonly string[]> {
    /**
     * Absolute path to current child entry.
     */
    const absolute = join(
      directory,
      entry.name,
    );

    if (entry.isDirectory())
      return walkFiles(absolute,);

    return Promise.resolve(entry.isFile() ? [absolute,] : [],);
  },),);

  return nested.flat();
}

/**
 * Finds explicit exclusion reason for a package-relative path.
 *
 * @param options - Candidate file and configured extra exclusions.
 *
 * @returns Reason string, or inclusion sentinel when file remains eligible.
 *
 * @example
 * ```ts
 * exclusionReason({ file: 'src/a.unit.test.ts', extraExclusions: {} });
 * // 'test file'
 * ```
 */
function exclusionReason(options: {
  readonly file: string;
  readonly extraExclusions: Readonly<Record<string, string>>;
},): ExclusionReason {
  if (!options.file
    .endsWith('.ts',))
    return 'non-TypeScript source';

  if (options.file
    .endsWith('.d.ts',))
    return DECLARATION_REASON;

  /**
   * Whether file suffix marks a test file.
   */
  const hasTestSuffix = TEST_SUFFIXES.some(function hasTestSuffix(suffix,): boolean {
    return options.file
      .endsWith(suffix,);
  },);

  if (hasTestSuffix)
    return TEST_FILE_REASON;

  if (toPosixPath(options.file,)
    .split('/',)
    .includes('fixtures',))
    return FIXTURE_REASON;

  return options.extraExclusions[options.file] ?? INCLUDED_SOURCE;
}

/**
 * Enumerates production TypeScript source files dynamically from a package.
 *
 * @param options - Package root and optional scan controls.
 *
 * @returns Sorted source files plus documented exclusions.
 *
 * @example
 * ```ts
 * const selection = await enumerateSourceFiles({ packageRoot: '/repo/pkg' });
 * console.log(selection.files.length);
 * ```
 */
export async function enumerateSourceFiles(options: SourceSelectionOptions,): Promise<SourceSelection> {
  /**
   * Source directory scanned for mutation targets.
   */
  const srcDir = options.srcDir ?? DEFAULT_SRC_DIR;
  /**
   * Absolute source root to walk.
   */
  const srcRoot = join(
    options.packageRoot,
    srcDir,
  );
  /**
   * Explicit package-relative source exclusions supplied by caller.
   */
  const extraExclusions = options.extraExclusions ?? {};
  /**
   * Absolute TypeScript and non-TypeScript files under source root.
   */
  const allFiles = await walkFiles(srcRoot,);
  /**
   * Package-relative file paths under source root.
   */
  const relativeFiles = allFiles.map(function toPackageRelative(file,): string {
    return relativePosix({
      from: options.packageRoot,
      to: file,
    },);
  },);

  /**
   * Included package-relative mutation target files.
   */
  const included: string[] = [];
  /**
   * Excluded package-relative files with documented reasons.
   */
  const excluded: SourceExclusion[] = [];

  for (const file of relativeFiles) {
    if (!isSafeRelativePath(file,)) {
      excluded.push({
        file,
        reason: 'unsafe relative path',
      },);
      continue;
    }

    /**
     * Exclusion reason or inclusion sentinel for current file.
     */
    const reason = exclusionReason({
      file,
      extraExclusions,
    },);

    if (reason === INCLUDED_SOURCE) {
      included.push(file,);
    }
    else {
      excluded.push({
        file,
        reason,
      },);
    }
  }

  return {
    files: sortStrings(included,),
    excluded: sortStrings(excluded.map(function exclusionKey(exclusion,): string {
      return `${exclusion.file}\u0000${exclusion.reason}`;
    },),)
      .map(function parseExclusion(entry,): SourceExclusion {
      /**
       * Encoded exclusion fields split back into file and reason.
       */
      const parts = entry.split('\u0000',);
      return {
        file: parts[0] ?? '',
        reason: parts[1] ?? '',
      };
    },),
  };
}
