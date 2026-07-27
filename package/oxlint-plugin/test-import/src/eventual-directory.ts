/**
 * Derivation of a package's eventual-artifact directories.
 *
 * An eventual artifact is what a package actually ships. A directory qualifies
 * when it is the conventional build root `dist/final`, or when the manifest
 * declares an entry inside it through `exports`, `main`, or `bin`.
 *
 * Two clauses narrow that. Targets under `src/` are discarded, because a
 * package that names its source as an entry is misconfigured and blessing it
 * would permit exactly the imports this rule exists to reject. The bare `dist`
 * root never counts, because a single asset entry such as
 * `./dist/Aquaticat-Regular.otf` would otherwise make every intermediate output
 * under `dist/temp` eventual.
 *
 * @module
 */

import { dirname, } from 'node:path';

import {
  isUnderDirectory,
  resolvePosix,
  toPosixPath,
} from './posix-path.ts';

/**
 * Package-relative directory every build task writes its final output to.
 */
const DEFAULT_ARTIFACT_ROOT = 'dist/final';

/**
 * Package-relative directory holding source, never a shipping directory.
 */
const SOURCE_ROOT = 'src';

/**
 * Package-relative build root whose immediate children may be intermediate output.
 */
const BUILD_ROOT = 'dist';

/**
 * Computes the directories whose contents count as the package's eventual artifact.
 *
 * @param packageRoot - normalized absolute package root
 *
 * @param shippingTargets - specifiers that package's manifest declares as entries
 *
 * @returns normalized absolute directories, always including the default artifact root
 *
 * @example
 * ```ts
 * eventualDirectories({ packageRoot: '/repo/package/module/x', shippingTargets: ['./dist/final/node/index.mjs'] });
 * ```
 *
 * @internal
 */
export function eventualDirectories({
  packageRoot,
  shippingTargets,
}: {
  /**
   * Normalized absolute package root.
   */
  readonly packageRoot: string;
  /**
   * Specifiers that package's manifest declares as entries.
   */
  readonly shippingTargets: readonly string[];
},): readonly string[] {
  /**
   * Conventional build output root, eventual for every package that builds.
   */
  const defaultRoot = resolvePosix({
    base: packageRoot,
    specifier: DEFAULT_ARTIFACT_ROOT,
  },);
  /**
   * Source root, used to discard entries that point at source rather than output.
   */
  const sourceRoot = resolvePosix({
    base: packageRoot,
    specifier: SOURCE_ROOT,
  },);
  /**
   * Build root, excluded so a single asset entry cannot bless intermediate output.
   */
  const buildRoot = resolvePosix({
    base: packageRoot,
    specifier: BUILD_ROOT,
  },);

  /**
   * Accumulated eventual directories, deduplicated by set membership.
   */
  const directories = new Set<string>([defaultRoot,],);

  for (const target of shippingTargets) {
    /**
     * Declared entry resolved against the package root.
     */
    const entry = resolvePosix({
      base: packageRoot,
      specifier: target,
    },);
    // A manifest naming its own source as an entry is a misconfiguration; the
    // sanctioned source channel is the `./ts` export, which is skipped upstream.
    if (isUnderDirectory({
      directory: sourceRoot,
      path: entry,
    },))
      continue;
    /**
     * Directory containing the declared entry.
     */
    const directory = toPosixPath({ path: dirname(entry,), },);
    if ((directory === buildRoot) || (directory === packageRoot))
      continue;
    directories.add(directory,);
  }

  return [...directories,];
}
