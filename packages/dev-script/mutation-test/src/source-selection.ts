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
  const entries = await readdir(
    directory,
    { withFileTypes: true, },
  );
  const nested = await Promise.all(entries.map(async function walkEntry(entry,): Promise<readonly string[]> {
    const absolute = join(
      directory,
      entry.name,
    );

    if (entry.isDirectory())
      return walkFiles(absolute,);

    return entry.isFile() ? [absolute,] : [];
  },),);

  return nested.flat();
}

/**
 * Finds explicit exclusion reason for a package-relative path.
 *
 * @param options - Candidate file and configured extra exclusions.
 *
 * @returns Reason string, or undefined when file remains eligible.
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
},): string | undefined {
  if (!options.file.endsWith('.ts',))
    return 'non-TypeScript source';

  if (options.file.endsWith('.d.ts',))
    return DECLARATION_REASON;

  const testReason = TEST_SUFFIXES.some(function hasTestSuffix(suffix,): boolean {
    return options.file.endsWith(suffix,);
  },)
    ? TEST_FILE_REASON
    : undefined;

  if (testReason !== undefined)
    return testReason;

  if (toPosixPath(options.file,).split('/',).includes('fixtures',))
    return FIXTURE_REASON;

  return options.extraExclusions[options.file];
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
  const srcDir = options.srcDir ?? DEFAULT_SRC_DIR;
  const srcRoot = join(
    options.packageRoot,
    srcDir,
  );
  const extraExclusions = options.extraExclusions ?? {};
  const allFiles = await walkFiles(srcRoot,);
  const relativeFiles = allFiles.map(function toPackageRelative(file,): string {
    return relativePosix({
      from: options.packageRoot,
      to: file,
    },);
  },);

  const included: string[] = [];
  const excluded: SourceExclusion[] = [];

  for (const file of relativeFiles) {
    if (!isSafeRelativePath(file,)) {
      excluded.push({
        file,
        reason: 'unsafe relative path',
      },);
      continue;
    }

    const reason = exclusionReason({
      file,
      extraExclusions,
    },);

    if (reason === undefined) {
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
    },),).map(function parseExclusion(entry,): SourceExclusion {
      const [file = '', reason = '',] = entry.split('\u0000',);
      return {
        file,
        reason,
      };
    },),
  };
}
