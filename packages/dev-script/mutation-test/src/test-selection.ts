/**
 * Test selection heuristics for per-source-file mutation runs.
 *
 * @example
 * ```ts
 * await selectTestsForSource({ packageRoot: '/repo/pkg', sourceFile: 'src/a.ts', fullSuite: false });
 * ```
 */

import { readdir, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  basenameWithoutTs,
  dirnamePosix,
  relativePosix,
  sortStrings,
  stripTsExtension,
} from './path-utils.ts';
import type { TestSelectionOptions, } from './types.ts';

/**
 * Package root relative directory containing source and tests.
 */
const SRC_DIR = 'src';

/**
 * Unit test suffix consumed by this monorepo's module-test harness.
 */
const UNIT_TEST_SUFFIX = '.unit.test.ts';

/**
 * Regression test suffix that is broad enough to include package-level guards.
 */
const REGRESSION_TEST_SUFFIX = '-regression.unit.test.ts';

/**
 * Integration test path used by file-enforcer and future packages with package-level integration tests.
 */
const INTEGRATION_TEST_PATH = 'src/integration.unit.test.ts';

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
 * Lists package-relative unit test files.
 *
 * @param packageRoot - Target package root.
 *
 * @returns Sorted package-relative unit tests.
 *
 * @example
 * ```ts
 * await listUnitTests('/repo/pkg');
 * ```
 */
async function listUnitTests(packageRoot: string,): Promise<readonly string[]> {
  /**
   * Absolute files discovered under package source tree.
   */
  const files = await walkFiles(join(
    packageRoot,
    SRC_DIR,
  ),);
  return sortStrings(files
    .map(function toRelative(file,): string {
      return relativePosix({
        from: packageRoot,
        to: file,
      },);
    },)
    .filter(function isUnitTest(file,): boolean {
      return file.endsWith(UNIT_TEST_SUFFIX,);
    },),);
}

/**
 * Returns whether a test stem and source stem look directly related.
 *
 * @param options - Source and test stems without `.ts` suffixes.
 *
 * @returns Whether either stem prefixes the other.
 *
 * @example
 * ```ts
 * stemsAreRelated({ sourceStem: 'glob-mirror', testStem: 'glob' });
 * // true
 * ```
 */
export function stemsAreRelated(options: {
  readonly sourceStem: string;
  readonly testStem: string;
},): boolean {
  return (options.sourceStem === options.testStem)
    || options.sourceStem
    .startsWith(`${options.testStem}-`,)
    || options.testStem
    .startsWith(`${options.sourceStem}-`,);
}

/**
 * Selects tests for one source file.
 *
 * Default mode runs directly related sibling tests plus package-level
 * regression and integration tests. Full-suite mode runs every unit test.
 * Returned paths are package-relative for execution from the container package cwd.
 *
 * @param options - Target package and source file selection inputs.
 *
 * @returns Sorted package-relative test files.
 *
 * @example
 * ```ts
 * await selectTestsForSource({
 *   packageRoot: '/repo/pkg',
 *   sourceFile: 'src/io/glob-mirror.ts',
 *   fullSuite: false,
 * });
 * ```
 */
export async function selectTestsForSource(options: TestSelectionOptions,): Promise<readonly string[]> {
  /**
   * Package-relative unit tests available to mutation runs.
   */
  const tests = await listUnitTests(options.packageRoot,);

  if (options.fullSuite)
    return tests;

  /**
   * Directory containing current source file.
   */
  const sourceDir = dirnamePosix(options.sourceFile,);
  /**
   * Basename stem for current source file.
   */
  const sourceStem = basenameWithoutTs(options.sourceFile,);
  /**
   * Manually configured package-wide tests.
   */
  const packageWideTests = options.packageWideTests ?? [];
  /**
   * Tests selected for current source file.
   */
  const selected = tests.filter(function isRelatedTest(testFile,): boolean {
    if (testFile === INTEGRATION_TEST_PATH)
      return true;

    if (testFile.endsWith(REGRESSION_TEST_SUFFIX,))
      return true;

    if (packageWideTests.includes(testFile,))
      return true;

    if (dirnamePosix(testFile,) !== sourceDir)
      return false;

    /**
     * Unit test basename without `.unit.test.ts`.
     */
    const testStem = stripTsExtension(basenameWithoutTs(testFile,)
      .slice(
      0,
      -'.unit.test'.length,
    ),);

    return stemsAreRelated({
      sourceStem,
      testStem,
    },);
  },);

  return sortStrings(selected,);
}
