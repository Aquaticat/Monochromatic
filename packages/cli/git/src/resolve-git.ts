import { constants, } from 'node:fs';
import {
  access,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  l,
  tagged,
} from './log.ts';

/**
 * Package name used to detect shims that delegate to this wrapper.
 * Any candidate whose file content contains this string is a shim for us,
 * whether it's a pnpm shell wrapper, a Bun symlink target, or anything else.
 * Real git binaries are ELF executables that will never contain this string.
 */
const PACKAGE_NAME = '@monochromatic-dev/cli-git';

/**
 * Checks whether a candidate binary is a package manager shim that delegates
 * to this wrapper package. Reads the file content and looks for the package name.
 *
 * @param candidatePath - Absolute path to the candidate binary.
 *
 * @returns `true` if the candidate is a shim for this package.
 */
async function isShimForSelf(candidatePath: string,): Promise<boolean> {
  try {
    /** Raw file bytes decoded as UTF-8; scanned below for the package-name marker. */
    const content = await readFile(
      candidatePath,
      'utf8',
    );
    return content.includes(PACKAGE_NAME,);
  }
  catch {
    return false;
  }
}

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

  /** Raw `PATH` environment value; empty string when unset so the split yields a no-op scan. */
  const pathEnv = process.env['PATH'] ?? '';
  /** Individual PATH entries, scanned in order so the first executable git wins. */
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

      // oxlint-disable-next-line no-await-in-loop -- sequential PATH scan; we need the first match and stop
      if (await isShimForSelf(candidate,)) {
        rl.debug(`skipping self at ${candidate}`,);
        continue;
      }

      rl.debug(`resolved real git at ${candidate}`,);
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
