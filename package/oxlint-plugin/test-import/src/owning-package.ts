/**
 * Discovery of the package that owns a linted file.
 *
 * Walks ancestor directories for the nearest `package.json` carrying a name,
 * then derives everything the rule needs about that package once. Results are
 * memoized per directory because they depend only on the package, never on
 * which file inside it is being linted. Clearing them per file would rebuild
 * identical data for every test in a package, so the cache deliberately
 * outlives the per-file visitor hooks.
 *
 * @module
 */

import { readFileSync, } from 'node:fs';
import {
  dirname,
  join,
} from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { declaresBuildTask, } from './build-task.ts';
import { eventualDirectories, } from './eventual-directory.ts';
import { isPackageManifest, } from './package-manifest.ts';
import { toPosixPath, } from './posix-path.ts';

/**
 * Logger for package discovery.
 */
const l = tagged({ tag: 'owning-package', },);

/**
 * Manifest filename that marks a package root.
 */
const MANIFEST_FILE = 'package.json';

/**
 * Sentinel meaning no ancestor directory holds a named manifest.
 *
 * @internal
 */
export const PACKAGE_UNRESOLVED: unique symbol = Symbol(
  'no package.json carrying a name exists above this file',
);

/**
 * Everything the rule needs to know about the package owning a file.
 *
 * @internal
 */
export type OwningPackage = {
  /**
   * Normalized absolute package root.
   */
  readonly root: string;
  /**
   * Declared package name, matched against bare import specifiers.
   */
  readonly name: string;
  /**
   * Whether the package declares a build task, and so ships an artifact at all.
   */
  readonly buildsArtifact: boolean;
  /**
   * Normalized absolute directories whose contents count as the eventual artifact.
   */
  readonly artifactDirectories: readonly string[];
};

/**
 * Memoized lookups keyed by the directory the walk started from.
 *
 * Package identity, build-task presence, and artifact directories are
 * properties of a package rather than of the file under lint, so entries stay
 * valid for a whole lint run and must not be cleared between files.
 */
const packageByDirectory = new Map<string, OwningPackage | typeof PACKAGE_UNRESOLVED>();

/**
 * Reads and parses one candidate manifest, treating any failure as absence.
 *
 * @param manifestPath - absolute path of the candidate manifest
 *
 * @returns parsed manifest contents, or undefined when unreadable or malformed
 *
 * @example
 * ```ts
 * readManifest({ manifestPath: '/repo/package/module/x/package.json' });
 * ```
 */
function readManifest({ manifestPath, }: {
  /**
   * Absolute path of the candidate manifest.
   */
  readonly manifestPath: string;
},): unknown {
  try {
    /* oxlint-disable no-restricted-syntax/no-sync -- Oxlint rule visitors run synchronously and expose no async hook to await a read from. */
    return JSON.parse(readFileSync(
      manifestPath,
      'utf8',
    ),);
    /* oxlint-enable no-restricted-syntax/no-sync */
  }
  catch (error: unknown) {
    l.debug(`manifest probe skipped for ${manifestPath}: ${String(error,)}`,);
    return undefined;
  }
}

/**
 * Derives package facts when a directory turns out to be a package root.
 *
 * @param directory - candidate package root
 *
 * @returns derived package facts, or the unresolved sentinel when absent or unnamed
 *
 * @example
 * ```ts
 * readPackageAt({ directory: '/repo/package/module/x' });
 * ```
 */
function readPackageAt({ directory, }: {
  /**
   * Candidate package root.
   */
  readonly directory: string;
},): OwningPackage | typeof PACKAGE_UNRESOLVED {
  /**
   * Parsed manifest contents; anything unnamed means this is not a package root.
   */
  const parsed = readManifest({
    manifestPath: join(
      directory,
      MANIFEST_FILE,
    ),
  },);
  if (!isPackageManifest(parsed,))
    return PACKAGE_UNRESOLVED;

  /**
   * Package root with separators normalized for containment tests.
   */
  const root = toPosixPath({ path: directory, },);
  return {
    root,
    name: parsed.name,
    buildsArtifact: declaresBuildTask({ packageRoot: directory, },),
    artifactDirectories: eventualDirectories({
      packageRoot: root,
      manifest: parsed,
    },),
  };
}

/**
 * Records one lookup result for every directory the walk passed through.
 *
 * @param visited - directories walked past before the result was known
 *
 * @param result - resolved package facts or the unresolved sentinel
 *
 * @returns same result, so callers can return the call directly
 *
 * @mutates visited - none; the shared directory cache absorbs the entries
 *
 * @example
 * ```ts
 * return memoize({ visited, result });
 * ```
 */
function memoize({
  visited,
  result,
}: {
  /**
   * Directories walked past before the result was known.
   */
  readonly visited: readonly string[];
  /**
   * Resolved package facts or the unresolved sentinel.
   */
  readonly result: OwningPackage | typeof PACKAGE_UNRESOLVED;
},): OwningPackage | typeof PACKAGE_UNRESOLVED {
  for (const directory of visited)
    packageByDirectory.set(
      directory,
      result,
    );
  return result;
}

/**
 * Finds the package owning a file, memoizing every directory visited on the way.
 *
 * @param fileName - absolute path of the file under lint
 *
 * @returns owning package facts, or the unresolved sentinel when none exists
 *
 * @example
 * ```ts
 * owningPackage({ fileName: '/repo/package/module/x/src/x.unit.test.ts' });
 * ```
 *
 * @internal
 */
export function owningPackage({ fileName, }: {
  /**
   * Absolute path of the file under lint.
   */
  readonly fileName: string;
},): OwningPackage | typeof PACKAGE_UNRESOLVED {
  /**
   * Directories walked past before a package root was found, memoized together.
   */
  const visited: string[] = [];
  /**
   * Root-inclusive cursor whose pending flag becomes false after the filesystem root.
   */
  const walk = {
    directory: dirname(fileName,),
    pending: true,
  };

  while (walk.pending) {
    /**
     * Memoized result for this directory, absent on first visit.
     */
    const cached = packageByDirectory.get(walk.directory,);
    if (cached !== undefined)
      return memoize({
        visited,
        result: cached,
      },);

    /**
     * Package facts if this directory is a package root.
     */
    const found = readPackageAt({ directory: walk.directory, },);
    if (found !== PACKAGE_UNRESOLVED) {
      packageByDirectory.set(
        walk.directory,
        found,
      );
      return memoize({
        visited,
        result: found,
      },);
    }

    visited.push(walk.directory,);
    /**
     * Parent used both as next candidate and as the filesystem-root identity check.
     */
    const parent = dirname(walk.directory,);
    walk.pending = parent !== walk.directory;
    walk.directory = parent;
  }

  return memoize({
    visited,
    result: PACKAGE_UNRESOLVED,
  },);
}
