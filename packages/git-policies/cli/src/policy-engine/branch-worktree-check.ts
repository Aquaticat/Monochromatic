import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  BRANCH_WORKTREE_ESCAPE_HATCH,
  parseBranchCreationRegion,
  stripBranchCreationEscapeHatch,
  type BranchCreationSubcommand,
} from '../parser/branch-create.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { resolveGit, } from '../resolve-git.ts';
import { branchCreationMessage, } from './branch-worktree-messages.ts';
import { implicitRemoteGuessCreatesBranch, } from './branch-worktree-remote-guess.ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

//region Branch worktree policy facts

/**
 * Git subcommands whose branch-creation modes must use `git worktree add`.
 */
const GUARDED_SUBCOMMANDS: ReadonlySet<string> = new Set([
  'branch',
  'checkout',
  'switch',
]);

/**
 * Narrows subcommand text to branch-creation guarded subcommands.
 *
 * @param subcommand - Subcommand located by global option parser.
 *
 * @returns `true` when subcommand can create branches outside `git worktree add`.
 *
 * @example
 * ```ts
 * isGuardedSubcommand('switch');
 * // => true
 * ```
 */
function isGuardedSubcommand(subcommand: string,): subcommand is BranchCreationSubcommand {
  return GUARDED_SUBCOMMANDS.has(subcommand,);
}

//endregion Branch worktree policy facts

/**
 * Expected branch-worktree policy violation.
 */
export class BranchWorktreeViolationError extends Error {
  /**
   * Creates expected policy violation.
   *
   * @param message - safe rejection explanation
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'BranchWorktreeViolationError';
  }
}

//region Branch worktree enforcement entry

/**
 * Rejects branch creation in the current worktree, directing callers to create
 * a linked worktree and branch together with `git worktree add -b`. The rule
 * guards explicit creation forms (`git branch <name>`, `git branch -c`,
 * `git checkout -b`, `git switch -c`, `--orphan`, and `--track`) plus the
 * remote-tracking branch guess that `git switch <name>` and `git checkout <name>`
 * perform when exactly one remote branch exists and no local branch does.
 *
 * Inspection, deletion, rename, upstream edits, detached checkouts, path
 * checkouts, and `git worktree add -b` pass through. The wrapper-only escape
 * hatch is stripped by {@link stripBranchCreationEscapeHatch} before
 * forwarding when a one-off bypass is needed.
 *
 * Subcommand location and creation facts come from {@link parseGlobalOptions}
 * and {@link parseBranchCreationRegion}; rejections are rendered by
 * {@link branchCreationMessage}; the remote-tracking guess is resolved via
 * {@link resolveGit} and confirmed by {@link implicitRemoteGuessCreatesBranch}.
 *
 * @param args - Git argv to inspect after wrapper invocation.
 *
 * @returns Original argv when command is unguarded or safe; argv with escape hatch stripped when bypassed.
 *
 * @throws When branch creation is requested outside `git worktree add`.
 *
 * @example
 * ```ts
 * await checkBranchWorktree(['switch', '-c', 'topic']);
 * // throws
 * ```
 */
export async function checkBranchWorktree(args: readonly string[],): Promise<readonly string[]> {
  /**
   * Effective cwd and subcommand index after walking pre-subcommand global options.
   */
  const { subcommandIndex, } = parseGlobalOptions(args,);
  /**
   * Subcommand at located index; absent when args carry no subcommand.
   */
  const subcommand = args[subcommandIndex];

  if (subcommand === undefined)
    return args;

  if (!isGuardedSubcommand(subcommand,))
    return args;

  /**
   * Tagged logger for branch-worktree-only rule.
   */
  const rl = tagged({
    tag: checkBranchWorktree.name,
    l,
  },);
  /**
   * Args after guarded subcommand.
   */
  const postSubcommandArgs = args.slice(subcommandIndex + 1,);
  /**
   * Parsed branch-creation facts for guarded subcommand.
   */
  const region = parseBranchCreationRegion({
    subcommand,
    postSubcommandArgs,
  },);

  if (region.hasEscapeHatch) {
    rl.debug(`${BRANCH_WORKTREE_ESCAPE_HATCH} present, stripping and skipping check`,);
    return stripBranchCreationEscapeHatch({
      args,
      subcommandIndex,
      subcommand,
    },);
  }

  if (region.createsBranch)
    throw new BranchWorktreeViolationError(branchCreationMessage({ subcommand, },),);

  /**
   * Target that may be created by git's implicit remote branch guessing.
   */
  const { implicitCreationTarget, } = region;
  /**
   * Whether parser found no implicit branch creation target to probe.
   */
  const hasNoImplicitTarget = (typeof implicitCreationTarget) === 'symbol';

  if (hasNoImplicitTarget)
    return args;

  /**
   * Pre-subcommand argv that captures caller's repository-selection layer.
   */
  const preSubcommandArgs = args.slice(
    0,
    subcommandIndex,
  );
  /**
   * Absolute path to real git binary for read-only branch existence probes.
   */
  const gitPath = await resolveGit();
  /**
   * Whether git would create a local branch through remote-tracking branch guessing.
   */
  const guessedBranchCreation = await implicitRemoteGuessCreatesBranch({
    gitPath,
    preSubcommandArgs,
    target: implicitCreationTarget,
  },);

  if (guessedBranchCreation) {
    throw new BranchWorktreeViolationError(branchCreationMessage({
      subcommand,
      target: implicitCreationTarget,
    },),);
  }

  return args;
}

//endregion Branch worktree enforcement entry
