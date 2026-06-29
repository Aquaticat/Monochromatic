import { dirname, } from 'node:path';

import { findUp, } from 'find-up';

import { parseGlobalOptions, } from '../parse-global-options.ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/** Logger root for cli-git after removing the package log shim. */
const l = tagged({ tag: 'cli-git', },);

/**
 * Git subcommands exempt from the repo-root requirement.
 * These either create a repo or query meta information without needing one.
 */
const EXEMPT_SUBCOMMANDS: ReadonlySet<string> = new Set([
  'init',
  'clone',
  'version',
  'help',
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
 * Enforces that, when the effective working directory (after applying
 * pre-subcommand `-C <path>` chaining) lives inside a git repository, it is
 * the root of that repository (where `.git` sits). When `.git` is not found
 * up the tree from the effective cwd, the rule passes the command through to
 * real git, which will surface its own error if the subcommand needs a repo.
 *
 * Exempt subcommands: init, clone, version, help.
 * Also exempts `config` with `--global`, `--system`, or `--list`.
 *
 * @param args - Raw git arguments (subcommand + flags).
 *
 * @returns Unmodified args if the check passes.
 *
 * @throws When inside a repo but not at its root.
 *
 * @example
 * ```ts
 * await requireRoot(['status']);
 * // throws if cwd is inside a repo but not at its root
 *
 * await requireRoot(['-C', '/repo-root', 'status']);
 * // passes even if process.cwd() is elsewhere
 *
 * await requireRoot(['clone', 'https://github.com/...']);
 * // always passes; clone is exempt
 * ```
 */
export async function requireRoot(args: readonly string[],): Promise<readonly string[]> {
  /**
   * Tagged logger for the require-root rule.
   */
  const rl = tagged({
    tag: requireRoot.name,
    l,
  },);

  /**
   * Effective cwd and subcommand index after walking pre-subcommand `-C` chaining.
   */
  const {
    effectiveCwd,
    subcommandIndex,
  } = parseGlobalOptions(args,);
  /**
   * Subcommand at the located index; `undefined` when args have no subcommand.
   */
  const subcommand = args[subcommandIndex];

  rl.debug(`effective cwd: ${effectiveCwd}, subcommand: ${subcommand ?? '(none)'}`,);

  if ((subcommand === undefined) || EXEMPT_SUBCOMMANDS
    .has(subcommand,)) {
    rl.debug(`exempt subcommand: ${subcommand ?? '(none)'}`,);
    return args;
  }

  if (subcommand === 'config') {
    /**
     * True when any global-scope flag (`--global`, `--system`, `--list`, `-l`) appears in args.
     */
    const hasGlobalFlag = args.some(function isGlobalConfigFlag(arg,) {
      return GLOBAL_CONFIG_FLAGS.has(arg,);
    },);
    if (hasGlobalFlag) {
      rl.debug('config with global/system/list flag: exempt',);
      return args;
    }
  }

  /**
   * Absolute path to the nearest `.git`, or `undefined` if not in a repo.
   */
  const gitPath = await findUp(
    '.git',
    {
      type: 'both',
      cwd: effectiveCwd,
    },
  );

  if (gitPath === undefined) {
    rl.debug('not inside a git repository: forwarding to real git',);
    return args;
  }

  /**
   * Directory containing the found `.git`.
   */
  const repoRoot = dirname(gitPath,);

  if (repoRoot !== effectiveCwd) {
    throw new Error(
      `cli-git: not at the root of the git repository. `
        + `Repo root is ${repoRoot} but effective cwd is ${effectiveCwd}. `
        + `Tip: cd to ${repoRoot} or pass -C ${repoRoot} before the subcommand.`,
    );
  }

  rl.debug('repo root check passed',);
  return args;
}
