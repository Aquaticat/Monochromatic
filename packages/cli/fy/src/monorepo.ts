/**
 * Monorepo root detection.
 *
 * Walks up the directory tree looking for a `package.json` with a `workspaces` field.
 *
 * @module
 */

import { join, } from 'node:path';

import {
  l,
  tagged,
} from './log.ts';

/**
 * Walks up from `startDir` looking for a directory containing a `package.json`
 * with a `workspaces` field, indicating a monorepo root.
 * Returns the path or `undefined` if none found.
 *
 * @param startDir - Directory to start searching from
 *
 * @returns Path to monorepo root, or `undefined`
 *
 * @example
 * ```ts
 * findMonorepoRoot('/home/user/project/packages/foo');
 * // => '/home/user/project'
 * ```
 */
export async function findMonorepoRoot(
  { startDir, }: { startDir: string; },
): Promise<string | undefined> {
  const rl = tagged({
    tag: findMonorepoRoot.name,
    l,
  },);
  let dir = startDir;
  /** Filesystem root sentinel -- stop when parent equals self */
  const ROOT = '/';
  while (dir !== ROOT) {
    const pkgPath = join(
      dir,
      'package.json',
    );
    try {
      // oxlint-disable-next-line no-await-in-loop -- intentionally sequential directory walk
      const content = await Bun.file(pkgPath,).text();
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns unknown
      const pkg = JSON.parse(content,) as Record<string, unknown>;
      if ('workspaces' in pkg) {
        rl.info(`found monorepo root at ${dir}`,);
        return dir;
      }
    }
    catch {
      // No package.json here, keep walking
    }
    const parent = join(
      dir,
      '..',
    );
    if (parent === dir)
      break;
    dir = parent;
  }
  rl.info('no monorepo root found',);
  return undefined;
}
