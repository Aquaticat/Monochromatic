/**
 * Package-root discovery: walk up from a starting directory looking
 * for a `package.json` whose `name` field matches a given value, and
 * return the directory containing it.
 *
 * Use this when code needs to anchor on its own package root regardless
 * of whether it's executing from `src/` (source mode) or a bundled
 * `dist/` subdirectory; the walk terminates at the same root in both.
 *
 * Matching by `name` is defensive: a missing or corrupted local
 * `package.json` triggers an explicit error instead of silently landing
 * on a parent monorepo manifest.
 *
 * Runtime: Node/Bun only. Uses `node:fs/promises` directly with no
 * browser fallback; current call sites pass `import.meta.dirname`,
 * which is itself Node-only. A cross-runtime backend (matching
 * {@link findMiseMonorepoRoot}'s OPFS support) can be added when a browser
 * consumer needs it.
 *
 * @module
 */

import { readFile, } from 'node:fs/promises';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/* oxlint-disable import/no-cycle -- barrel re-export cycle; dirname and resolve are fully initialized before findPackageRoot runs */
import {
  dirname,
  resolve,
} from './index.ts';
/* oxlint-enable import/no-cycle */

//region Walk

/**
 * Tagged logger for package-root discovery diagnostics.
 */
const findPackageRootLogger = tagged({ tag: 'findPackageRoot', },);

/**
 * Walks up from `dir` searching for a `package.json` whose `name`
 * field equals `name`, returning the directory that contains it.
 *
 * Recursion terminates at the matching package (success) or at the
 * filesystem root (throws). Each level reads at most one file.
 *
 * @param dir - starting directory; `dir/package.json` is tested first, then `dirname(dir)`, recursively
 *
 * @param name - expected `name` value in the matched `package.json`
 *
 * @returns absolute path of directory containing matching `package.json`
 *
 * @throws when no matching `package.json` is found up to filesystem root
 *
 * @example
 * ```ts
 * const root = await findPackageRoot({
 *   dir: import.meta.dirname,
 *   name: 'pkg-name',
 * });
 * ```
 */
export async function findPackageRoot(
  {
    dir,
    name,
  }: {
    readonly dir: string;
    readonly name: string;
  },
): Promise<string> {
  /**
   * Path to the manifest tested at the current level before recursing upward.
   */
  const candidate = resolve([
    dir,
    'package.json',
  ],);
  try {
    /**
     * Raw file contents read up front so JSON parsing and the read share one `try` block; either failure routes to the upward walk.
     */
    const contents = await readFile(
      candidate,
      'utf8',
    );
    /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns `any`; package.json shape is well-known and we only consume the optional `name` field, which the `===` check tolerates if absent. */
    /**
     * Cast to expose the optional `name` field for the discriminant compare below.
     */
    const parsed = JSON.parse(contents,) as { name?: string; };
    /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
    if (parsed.name
      === name)
      return dir;
  }
  catch (error: unknown) {
    findPackageRootLogger.debug(`skipping package manifest candidate ${candidate}: ${caughtValueText(error,)}`,);
  }
  /**
   * Next directory to inspect; equal to `dir` only at the filesystem root, which terminates recursion.
   */
  const parent = dirname(dir,);
  if (parent === dir) {
    throw new Error(
      `could not find package.json with name ${name} walking up from ${dir}`,
    );
  }
  return findPackageRoot({
    dir: parent,
    name,
  },);
}

//endregion Walk

//region Cached variant

/**
 * Process-lifetime cache for {@link findPackageRootCached}, keyed by `name`.
 *
 * Caches the in-flight promise (not the resolved string) so concurrent
 * first callers share one walk. Rejected promises stay in the cache
 * because package layout does not change during a process lifetime;
 * if the walk failed once it would fail again on retry.
 *
 * Caching by `name` rather than `(dir, name)` lets two callers in
 * different modules of the same package - with different
 * `import.meta.dirname` values - share one walk. Safe because a given
 * package name resolves to exactly one root per process under
 * npm/pnpm semantics.
 */
const cache = new Map<string, Promise<string>>();

/**
 * Memoised variant of {@link findPackageRoot}: subsequent calls with
 * the same `name` reuse the first walk's promise.
 *
 * On cache miss, `dir` decides where the walk starts; on cache hit,
 * `dir` is ignored and the previously-resolved root is returned.
 *
 * @param dir - starting directory; ignored on cache hit
 *
 * @param name - expected `name` value; used as cache key
 *
 * @returns absolute path of directory containing matching `package.json`
 *
 * @throws propagates {@link findPackageRoot}'s rejection on miss; subsequent calls re-resolve to the same rejection
 *
 * @example
 * ```ts
 * const root = await findPackageRootCached({
 *   dir: import.meta.dirname,
 *   name: 'pkg-name',
 * });
 * ```
 */
export function findPackageRootCached(
  {
    dir,
    name,
  }: {
    readonly dir: string;
    readonly name: string;
  },
): Promise<string> {
  /**
   * In-flight or resolved promise from a prior call; presence means another caller is already walking for this `name`.
   */
  const existing = cache.get(name,);
  if (existing !== undefined)
    return existing;
  /**
   * Fresh walk started before the cache write so concurrent first callers all observe the same in-flight promise.
   */
  const walking = findPackageRoot({
    dir,
    name,
  },);
  cache.set(
    name,
    walking,
  );
  return walking;
}

//endregion Cached variant
