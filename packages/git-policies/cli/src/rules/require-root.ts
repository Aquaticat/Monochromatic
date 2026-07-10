import {
  findGitRepoRoot,
  GitRepositoryRootNotFoundError,
} from '@monochromatic-dev/module-fs-path/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { parseGlobalOptions, } from '../parse-global-options.ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
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
 * Sentinel returned when no structurally valid Git root exists.
 */
const VALID_GIT_ROOT_ABSENT: unique symbol = Symbol(
  'No ancestor has a structurally usable Git administrative marker',
);

/**
 * Resolves usable Git repository root without treating expected absence as failure.
 *
 * @param cwd - effective command working directory
 *
 * @returns root path or absence sentinel
 *
 * @throws unexpected filesystem errors
 *
 * @example
 * ```ts
 * await resolveValidGitRoot('/repo/subdirectory');
 * ```
 */
async function resolveValidGitRoot(cwd: string,): Promise<string | typeof VALID_GIT_ROOT_ABSENT> {
  try {
    return await findGitRepoRoot({ cwd, },);
  }
  catch (error: unknown) {
    if (error instanceof GitRepositoryRootNotFoundError)
      return VALID_GIT_ROOT_ABSENT;
    throw error;
  }
}

/**
 * Expected require-root policy violation.
 *
 * @example
 * ```ts
 * throw new RequireRootViolationError('not at repository root');
 * ```
 */
export class RequireRootViolationError extends Error {
  /**
   * Creates policy violation error used by legacy wrapper adapter.
   *
   * @param message - complete user-facing finding message
   *
   * @example
   * ```ts
   * new RequireRootViolationError('not at root');
   * ```
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'RequireRootViolationError';
  }
}

/**
 * Enforces that, when the effective working directory (computed by
 * {@link parseGlobalOptions} after applying pre-subcommand `-C <path>`
 * chaining) lives inside a git repository, it is the root of that repository
 * (where `.git` sits). When `.git` is not found up the tree from the
 * effective cwd, the rule passes the command through to real git, which will
 * surface its own error if the subcommand needs a repo.
 *
 * Exempt subcommands: {@link EXEMPT_SUBCOMMANDS}.
 * Also exempts `config` with any {@link GLOBAL_CONFIG_FLAGS}.
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
   * Nearest root with a structurally usable Git marker.
   */
  const repoRoot = await resolveValidGitRoot(effectiveCwd,);
  if (repoRoot === VALID_GIT_ROOT_ABSENT) {
    rl.debug('not inside a valid Git repository',);
    return args;
  }

  if (repoRoot !== effectiveCwd) {
    throw new RequireRootViolationError(
      `cli-git: not at the root of the git repository. `
        + `Repo root is ${repoRoot} but effective cwd is ${effectiveCwd}. `
        + `Tip: cd to ${repoRoot} or pass -C ${repoRoot} before the subcommand.`,
    );
  }

  rl.debug('repo root check passed',);
  return args;
}
