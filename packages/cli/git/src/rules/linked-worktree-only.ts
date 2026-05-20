import {
  l,
  tagged,
} from '../log.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { cleanChangesWorktree, } from './clean-worktree-policy.ts';
import {
  CLEAN_SUBCOMMAND,
  RESET_SUBCOMMAND,
  STASH_SUBCOMMAND,
  WORKTREE_ENFORCEMENT_ESCAPE_HATCH,
  type GuardedCommand,
} from './linked-worktree-constants.ts';
import {
  hasWorktreeEnforcementEscapeHatch,
  stripWorktreeEnforcementEscapeHatch,
} from './linked-worktree-escape-hatch.ts';
import {
  mainWorktreeMessage,
  outsideWorktreeMessage,
} from './linked-worktree-messages.ts';
import { resetChangesWorktree, } from './reset-worktree-policy.ts';
import { detectWorktreeLocation, } from './worktree-location.ts';

//region Linked worktree enforcement

/** Options for testing whether a command form needs linked-worktree enforcement. */
type CommandRequiresLinkedWorktreeOptions = {
  /** Guarded git subcommand. */
  readonly subcommand: GuardedCommand;
  /** Arguments strictly after subcommand. */
  readonly postSubcommandArgs: readonly string[];
};

/**
 * Narrows subcommand string to commands covered by linked-worktree policy.
 *
 * @param subcommand - Subcommand located by global option parser.
 *
 * @returns `true` when subcommand has linked-worktree policy.
 *
 * @example
 * ```ts
 * isGuardedCommand('stash');
 * // => true
 * ```
 */
function isGuardedCommand(subcommand: string | undefined,): subcommand is GuardedCommand {
  return (subcommand === STASH_SUBCOMMAND)
    || (subcommand === CLEAN_SUBCOMMAND)
    || (subcommand === RESET_SUBCOMMAND);
}

/**
 * Determines whether a guarded command form needs linked-worktree enforcement.
 *
 * @param subcommand - Guarded git subcommand.
 *
 * @param postSubcommandArgs - Arguments strictly after subcommand.
 *
 * @returns `true` when invocation can modify worktree filesystem state.
 *
 * @example
 * ```ts
 * commandRequiresLinkedWorktree({ subcommand: 'reset', postSubcommandArgs: ['--hard'] });
 * // => true
 * ```
 */
function commandRequiresLinkedWorktree({
  subcommand,
  postSubcommandArgs,
}: CommandRequiresLinkedWorktreeOptions,): boolean {
  if (subcommand === STASH_SUBCOMMAND)
    return true;

  if (subcommand === CLEAN_SUBCOMMAND)
    return cleanChangesWorktree(postSubcommandArgs,);

  if (subcommand === RESET_SUBCOMMAND)
    return resetChangesWorktree(postSubcommandArgs,);

  throw new Error(`cli-git: unhandled linked-worktree command ${String(subcommand,)}.`);
}

/**
 * Rejects state-changing guarded commands unless effective working directory is
 * a linked git worktree root. This covers all `git stash`, non-dry-run
 * `git clean`, and destructive `git reset` modes (`--hard`, `--merge`,
 * `--keep`). These commands can update or delete files in the selected
 * worktree, so allowing main-worktree or outside-worktree forms can change
 * filesystem state outside what caller expects from current cwd.
 *
 * The wrapper-only flag `--no-enforce-worktree` is the escape hatch: place it
 * after the guarded subcommand and before any `--` pathspec separator. It is
 * stripped from args before forwarding, and linked-worktree detection is
 * skipped for that invocation.
 *
 * @param args - Git argv to inspect after wrapper invocation.
 *
 * @returns Original argv when command is unguarded or linked-worktree-safe;
 *   argv with `--no-enforce-worktree` stripped when escape hatch is in use.
 *
 * @throws When guarded state-changing invocation is requested outside linked git worktree.
 *
 * @example
 * ```ts
 * await linkedWorktreeOnly(['-C', '/repo-linked', 'stash']);
 * // passes when real git reports /repo-linked is a linked worktree
 *
 * await linkedWorktreeOnly(['-C', '/repo-main', 'clean', '-fd']);
 * // throws when /repo-main is the main worktree
 *
 * await linkedWorktreeOnly(['-C', '/repo-main', 'clean', '-ndX']);
 * // passes because dry-run clean does not delete files
 * ```
 */
export async function linkedWorktreeOnly(
  args: readonly string[],
): Promise<readonly string[]> {
  /** Effective cwd and subcommand index after walking pre-subcommand `-C` chaining. */
  const {
    effectiveCwd,
    subcommandIndex,
  } = parseGlobalOptions(args,);
  /** Subcommand at the located index; `undefined` when args have no subcommand. */
  const subcommand = args[subcommandIndex];

  if (!isGuardedCommand(subcommand,))
    return args;

  /** Tagged logger for the linked-worktree-only rule. */
  const rl = tagged({
    tag: linkedWorktreeOnly.name,
    l,
  },);

  /** Slice of args strictly after guarded subcommand. */
  const postSubcommandArgs = args.slice(subcommandIndex + 1,);
  /** True when wrapper-only escape hatch appears before pathspec separator. */
  const shouldSkipEnforcement = hasWorktreeEnforcementEscapeHatch({ postSubcommandArgs, },);

  if (shouldSkipEnforcement) {
    rl.debug(
      `${WORKTREE_ENFORCEMENT_ESCAPE_HATCH} present, stripping and skipping linked-worktree check`,
    );
    return stripWorktreeEnforcementEscapeHatch({
      args,
      subcommandIndex,
    },);
  }

  /** True when command form can update or delete files in selected worktree. */
  const shouldEnforce = commandRequiresLinkedWorktree({
    subcommand,
    postSubcommandArgs,
  },);

  if (!shouldEnforce)
    return args;

  rl.debug(`effective cwd: ${effectiveCwd}, subcommand: ${subcommand}`,);

  /** Effective cwd classification for linked worktree safety policy. */
  const worktreeLocation = await detectWorktreeLocation({ effectiveCwd, },);

  if (worktreeLocation === 'outside-worktree')
    throw new Error(outsideWorktreeMessage({ command: subcommand, },),);

  if (worktreeLocation === 'main-worktree')
    throw new Error(mainWorktreeMessage({ command: subcommand, },),);

  rl.debug('linked worktree check passed',);
  return args;
}

//endregion Linked worktree enforcement
