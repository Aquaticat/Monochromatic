import { constants, } from 'node:fs';
import {
  access,
  realpath,
} from 'node:fs/promises';
import {
  dirname,
  join,
  resolve,
} from 'node:path';
import { fileURLToPath, } from 'node:url';

import {
  l,
  tagged,
} from './log.ts';

/**
 * Package root directory for this wrapper, used to identify and skip
 * our own bin entry when scanning PATH.
 * Computed as two levels up from `src/resolve-git.ts`.
 */
const PACKAGE_DIR = resolve(
  dirname(
    fileURLToPath(import.meta.url,),
  ),
  '..',
);

/**
 * Locates the real git binary by scanning PATH entries,
 * skipping any that resolve back into this package's directory tree.
 *
 * Sequential scanning is intentional: we need the first PATH match
 * and can stop immediately, so parallelizing would waste work.
 *
 * @returns Absolute path to the real git binary.
 *
 * @throws When no real git binary is found on PATH.
 *
 * @example
 * ```ts
 * const gitPath = await resolveGit();
 * // => '/usr/bin/git'
 * ```
 */
export async function resolveGit(): Promise<string> {
  /** Tagged logger for git binary resolution. */
  const rl = tagged({
    tag: resolveGit.name,
    l,
  },);

  const pathEnv = process.env['PATH'] ?? '';
  const pathDirs = pathEnv.split(':',);

  for (const dir of pathDirs) {
    /** Candidate git binary path in this PATH entry. */
    const candidate = join(
      dir,
      'git',
    );
    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential PATH scan; we need the first match and stop
      await access(
        candidate,
        constants.X_OK,
      );

      /** Resolved real path, following symlinks. */
      // oxlint-disable-next-line no-await-in-loop -- sequential PATH scan; we need the first match and stop
      const real = await realpath(candidate,);
      if (real.startsWith(`${PACKAGE_DIR}/`,)) {
        rl.debug(`skipping self at ${candidate}`,);
        continue;
      }

      rl.debug(`resolved real git at ${candidate} (realpath: ${real})`,);
      return candidate;
    }
    catch {
      continue;
    }
  }

  throw new Error(
    'cli-git: could not find real git binary on PATH. '
      + 'Ensure git is installed at /usr/bin/git or another PATH entry.',
  );
}
