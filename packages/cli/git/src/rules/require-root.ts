import { dirname, } from 'node:path';

import { findUp, } from 'find-up';

import {
  l,
  tagged,
} from '../log.ts';

/**
 * Git subcommands exempt from the repo-root requirement.
 * These either create a repo or query meta information without needing one.
 */
const EXEMPT_SUBCOMMANDS: ReadonlySet<string> = new Set([
  'init',
  'clone',
  'version',
  'help',
  '-v',
  '--version',
  '--help',
],);

/**
 * Flags on `git config` that operate globally and don't require a repo.
 */
const GLOBAL_CONFIG_FLAGS: ReadonlySet<string> = new Set([
  '--global',
  '--system',
  '--list',
  '-l',
],);

/**
 * Enforces that the working directory is the root of a git repository.
 * Uses `findUp` to locate `.git` up the directory tree, then verifies
 * that it lives in the current directory (not a parent).
 *
 * Exempt subcommands: init, clone, version, help.
 * Also exempts `config` with `--global`, `--system`, or `--list`.
 *
 * @param args - Raw git arguments (subcommand + flags).
 *
 * @returns Unmodified args if the check passes.
 *
 * @throws When not at repo root and the command requires it.
 *
 * @example
 * ```ts
 * await requireRoot(['status']);
 * // throws if cwd is not the repo root
 *
 * await requireRoot(['clone', 'https://github.com/...']);
 * // always passes -- clone is exempt
 * ```
 */
export async function requireRoot(args: readonly string[],): Promise<readonly string[]> {
  /** Tagged logger for the require-root rule. */
  const rl = tagged({
    tag: requireRoot.name,
    l,
  },);

  const [subcommand,] = args;

  if (subcommand === undefined || EXEMPT_SUBCOMMANDS.has(subcommand,)) {
    rl.debug(`exempt subcommand: ${subcommand ?? '(none)'}`,);
    return args;
  }

  if (subcommand === 'config') {
    const hasGlobalFlag = args.some(function isGlobalConfigFlag(arg,) {
      return GLOBAL_CONFIG_FLAGS.has(arg,);
    },);
    if (hasGlobalFlag) {
      rl.debug('config with global/system/list flag -- exempt',);
      return args;
    }
  }

  /** Absolute path to the nearest `.git`, or `undefined` if not in a repo. */
  const gitPath = await findUp(
    '.git',
    { type: 'directory', },
  );

  if (gitPath === undefined) {
    throw new Error(
      'cli-git: not inside a git repository. '
        + 'Tip: run this command inside a git repository.',
    );
  }

  /** Directory containing the found `.git`. */
  const repoRoot = dirname(gitPath,);

  if (repoRoot !== process.cwd()) {
    throw new Error(
      `cli-git: not at the root of the git repository. `
        + `Repo root is ${repoRoot} but cwd is ${process.cwd()}. `
        + `Tip: cd ${repoRoot}`,
    );
  }

  rl.debug('repo root check passed',);
  return args;
}
