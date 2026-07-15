/**
 * Runtime source discovery for one installed package.
 *
 * @module
 */

import {
  type Dirent,
  readdirSync,
} from 'node:fs';
import {
  extname,
  join,
} from 'node:path';

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Runtime source suffixes accepted by external effect analysis.
 */
const RUNTIME_SOURCE_SUFFIXES: ReadonlySet<string> = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.jsx',
  '.tsx',
]);

/**
 * Tests whether package file is runtime source rather than declaration output.
 *
 * @param path - Package-local file path.
 *
 * @returns whether generated project should load file as runtime source.
 *
 * @example
 * ```ts
 * runtimeSourceFile('/package/dist/index.mjs');
 * ```
 */
function runtimeSourceFile(path: string,): boolean {
  if (path.endsWith('.d.ts',)
    || path.endsWith('.d.mts',)
    || path.endsWith('.d.cts',))
    return false;
  return RUNTIME_SOURCE_SUFFIXES.has(extname(path,),);
}

/**
 * Enumerates shipped runtime source so relative imports cannot resolve only to adjacent declarations.
 *
 * Package traversal skips dependency links under `node_modules`.
 * Returned paths are deterministic and always include selected implementation entry.
 *
 * @param packageRoot - Exact installed package root.
 *
 * @param implementationPath - Runtime entry selected from package exports.
 *
 * @returns sorted runtime source paths in installed package.
 *
 * @example
 * ```ts
 * externalImplementationFiles({ packageRoot, implementationPath });
 * ```
 */
export function externalImplementationFiles({
  packageRoot,
  implementationPath,
}: {
  readonly packageRoot: string;
  readonly implementationPath: string;
}): readonly string[] {
  /**
   * Directory work stack for bounded structural traversal.
   */
  const pending = [packageRoot,];
  /**
   * Runtime source identities discovered under package root.
   */
  const paths = new Set<string>([implementationPath,],);
  while (pending.length > 0) {
    /**
     * Next package directory from work stack.
     */
    const directory = pending.pop();
    if (directory === undefined)
      break;
    /* oxlint-disable no-restricted-syntax/no-sync -- Semantic rule execution is synchronous and scans each demanded package snapshot once. */
    /**
     * Foreign package directory entries returned by Node filesystem boundary.
     */
    const entries: ForeignBorrowed<Dirent[]> = readdirSync(
      directory,
      { withFileTypes: true, },
    );
    /* oxlint-enable no-restricted-syntax/no-sync */
    for (const entry of entries) {
      /**
       * Absolute package child path selected for traversal or inclusion.
       */
      const path = join(
        directory,
        entry.name,
      );
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules')
          pending.push(path,);
        continue;
      }
      if (entry.isFile() && runtimeSourceFile(path,))
        paths.add(path,);
    }
  }
  return [...paths,]
    .toSorted();
}
