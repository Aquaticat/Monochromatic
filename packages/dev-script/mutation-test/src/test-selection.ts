/**
 * Test selection heuristics for per-source-file mutation runs.
 *
 * @example
 * ```ts
 * await selectTestsForSource({ packageRoot: '/repo/pkg', sourceFile: 'src/a.ts', fullSuite: false });
 * ```
 */

import { readdir, } from 'node:fs/promises';
import {
  basename,
  dirname,
  join,
} from 'node:path';

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
 * Delimiter separating a package name from its sidecar concern. A sidecar of
 * `jsonc-edit` is the sibling directory `jsonc-edit.fuzz`.
 */
const SIDECAR_DELIMITER = '.';

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
 * Lists package-root-relative unit tests from sibling sidecar packages.
 *
 * A sidecar is a sibling directory named `<package><SIDECAR_DELIMITER><concern>`
 * (for example `jsonc-edit.fuzz`, `jsonc-edit.conformance`), holding non-runtime
 * tooling kept out of the runtime package so a whole-package run only mutates real
 * runtime files. Its `*.unit.test.ts` files import the package under test through
 * its workspace `/ts` subpath, which the container resolves through a direct
 * relative symlink to the mutated `/work` source, so they kill mutants too. Returned
 * paths are relative to the package root, so they resolve from the Stryker cwd
 * (for example `../jsonc-edit.fuzz/src/round-trip.property.unit.test.ts`). Packages
 * with no sidecars yield an empty list, leaving single-package selection unchanged.
 *
 * @param packageRoot - Absolute target package root.
 *
 * @returns Sorted package-root-relative sidecar unit test files.
 *
 * @example
 * ```ts
 * await listSidecarTests('/repo/packages/module/jsonc-edit');
 * // ['../jsonc-edit.conformance/src/jsonc.conformance.unit.test.ts', ...]
 * ```
 */
async function listSidecarTests(packageRoot: string,): Promise<readonly string[]> {
  /**
   * Directory holding the package under test and its sidecars.
   */
  const parent = dirname(packageRoot,);
  /**
   * Sidecar directory-name prefix derived from the package basename.
   */
  const prefix = `${basename(packageRoot,)}${SIDECAR_DELIMITER}`;
  /**
   * Sibling entries beside the package under test.
   */
  const siblings = await readdir(
    parent,
    { withFileTypes: true, },
  );
  /**
   * Per-sidecar package-root-relative unit test lists.
   */
  const sidecarTestLists = await Promise.all(siblings
    .filter(function isSidecar(entry,): boolean {
      return entry.isDirectory()
        && entry.name
        .startsWith(prefix,);
    },)
    .map(async function sidecarTests(entry,): Promise<readonly string[]> {
      /**
       * Source directory of one sidecar package.
       */
      const sidecarSrc = join(
        parent,
        entry.name,
        SRC_DIR,
      );
      /**
       * Absolute files under the sidecar source tree, or none when it has none.
       */
      const files = await walkSidecarSource(sidecarSrc,);
      return files
        .filter(function isUnitTest(file,): boolean {
          return file.endsWith(UNIT_TEST_SUFFIX,);
        },)
        .map(function toPackageRootRelative(file,): string {
          return relativePosix({
            from: packageRoot,
            to: file,
          },);
        },);
    },),);

  return sortStrings(sidecarTestLists.flat(),);
}

/**
 * Walks a sidecar source directory, returning no files when it is absent.
 *
 * @param sidecarSrc - Absolute sidecar source directory.
 *
 * @returns Absolute descendant files, or empty when the directory is missing.
 *
 * @throws Error when the directory exists but cannot be read.
 *
 * @example
 * ```ts
 * await walkSidecarSource('/repo/packages/module/jsonc-edit.fuzz/src');
 * ```
 */
async function walkSidecarSource(sidecarSrc: string,): Promise<readonly string[]> {
  try {
    return await walkFiles(sidecarSrc,);
  }
  catch (error: unknown) {
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT'))
      return [];
    throw new Error(
      `failed to walk sidecar source ${sidecarSrc}`,
      { cause: error, },
    );
  }
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
 * Removes test suffixes that do not describe source stem affinity.
 *
 * @param testFile - Package-relative test file.
 *
 * @returns Test stem used for source/test relationship checks.
 *
 * @example
 * ```ts
 * relatedTestStem('src/watch-regression.unit.test.ts');
 * // 'watch'
 * ```
 */
function relatedTestStem(testFile: string,): string {
  /**
   * Unit test basename without `.unit.test.ts`.
   */
  const unitStem = stripTsExtension(basenameWithoutTs(testFile,)
    .slice(
      0,
      -'.unit.test'.length,
    ),);

  return unitStem.endsWith('-regression',)
    ? unitStem.slice(
      0,
      -'-regression'.length,
    )
    : unitStem;
}

/**
 * Selects tests for one source file.
 *
 * Default mode runs directly related sibling tests, related regression tests,
 * and package-level integration tests. Full-suite mode runs every unit test.
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
  /**
   * Sibling sidecar unit tests, included regardless of mode because they
   * exercise the whole package against the mutated source.
   */
  const sidecarTests = await listSidecarTests(options.packageRoot,);

  if (options.fullSuite)
    return sortStrings([
      ...tests,
      ...sidecarTests,
    ],);

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

    if (packageWideTests.includes(testFile,))
      return true;

    if ((!testFile.endsWith(REGRESSION_TEST_SUFFIX,))
      && (dirnamePosix(testFile,) !== sourceDir))
      return false;

    /**
     * Unit test basename without relationship-neutral suffixes.
     */
    const testStem = relatedTestStem(testFile,);

    return stemsAreRelated({
      sourceStem,
      testStem,
    },);
  },);

  return sortStrings([
    ...selected,
    ...sidecarTests,
  ],);
}
