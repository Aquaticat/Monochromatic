import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  classifyEffectiveTarget,
  type EffectiveTarget,
} from '../effective-target.ts';
import { stripEscapeHatch, } from '../escape-hatch.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import {
  cleanChangesWorktree,
  parseCleanRegion,
} from '../parser/clean.ts';
import {
  parseResetRegion,
  resetChangesWorktree,
} from '../parser/reset.ts';
import { parseStashRegion, } from '../parser/stash.ts';
import {
  CLEAN_SUBCOMMAND,
  type GuardedCommand,
  RESET_SUBCOMMAND,
  STASH_SUBCOMMAND,
} from './linked-worktree-constants.ts';
import {
  mainWorktreeMessage,
  outsideWorktreeMessage,
} from './linked-worktree-messages.ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

//region Guarded command predicates and policy facts

/**
 * Per-subcommand fact set produced by an optique-based region parser.
 */
type GuardedRegion = {
  /**
   * True when wrapper-only escape hatch appears as a real flag.
   */
  readonly hasEscapeHatch: boolean;
  /**
   * True when invocation can change worktree filesystem state.
   */
  readonly changesWorktree: boolean;
  /**
   * Options that consume the *next* argv token; used to strip flag-position escape hatches without disturbing values.
   */
  readonly separateValueOptions: ReadonlySet<string>;
};

/**
 * Stash options that consume the next argv token.
 */
const STASH_VALUE_OPTIONS: ReadonlySet<string> = new Set([
  '-m',
  '--message',
  '--pathspec-from-file',
],);

/**
 * Clean options that consume the next argv token (long form is matched via abbreviation table inside the parser).
 */
const CLEAN_VALUE_OPTIONS: ReadonlySet<string> = new Set([
  '-e',
  '--exclude',
],);

/**
 * Reset options that consume the next argv token.
 */
const RESET_VALUE_OPTIONS: ReadonlySet<string> = new Set([
  '--pathspec-from-file',
],);

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
function isGuardedCommand(subcommand: string,): subcommand is GuardedCommand {
  return (subcommand === STASH_SUBCOMMAND)
    || (subcommand === CLEAN_SUBCOMMAND)
    || (subcommand === RESET_SUBCOMMAND);
}

/**
 * Options for computing per-subcommand facts.
 */
type ComputeRegionOptions = {
  /**
   * Guarded git subcommand.
   */
  readonly subcommand: GuardedCommand;
  /**
   * Arguments strictly after subcommand.
   */
  readonly postSubcommandArgs: readonly string[];
};

/**
 * Selects the appropriate optique-based parser for the subcommand
 * ({@link parseStashRegion}, {@link parseCleanRegion} with
 * {@link cleanChangesWorktree}, or {@link parseResetRegion} with
 * {@link resetChangesWorktree}) and turns its result into the common
 * {@link GuardedRegion} shape used by the rule.
 *
 * @param subcommand - Guarded git subcommand.
 *
 * @param postSubcommandArgs - Arguments strictly after subcommand.
 *
 * @returns Region facts.
 *
 * @example
 * ```ts
 * computeRegion({ subcommand: 'clean', postSubcommandArgs: ['-ndX'] });
 * // changesWorktree = false (dry-run)
 * ```
 */
function computeRegion({
  subcommand,
  postSubcommandArgs,
}: ComputeRegionOptions,): GuardedRegion {
  if (subcommand === STASH_SUBCOMMAND) {
    /**
     * Stash region facts; stash is always destructive when forwarded.
     */
    const stash = parseStashRegion(postSubcommandArgs,);
    return {
      hasEscapeHatch: stash.hasEscapeHatch,
      changesWorktree: true,
      separateValueOptions: STASH_VALUE_OPTIONS,
    };
  }

  if (subcommand === CLEAN_SUBCOMMAND) {
    /**
     * Clean region facts; destructiveness depends on dry-run / interactive flags.
     */
    const clean = parseCleanRegion(postSubcommandArgs,);
    return {
      hasEscapeHatch: clean.hasEscapeHatch,
      changesWorktree: cleanChangesWorktree(clean,),
      separateValueOptions: CLEAN_VALUE_OPTIONS,
    };
  }

  /**
   * Reset region facts; destructive when --hard/--merge/--keep (or abbreviation) appears.
   */
  const reset = parseResetRegion(postSubcommandArgs,);
  return {
    hasEscapeHatch: reset.hasEscapeHatch,
    changesWorktree: resetChangesWorktree(reset,),
    separateValueOptions: RESET_VALUE_OPTIONS,
  };
}

//endregion Guarded command predicates and policy facts

/**
 * Expected linked-worktree policy violation.
 */
export class LinkedWorktreeViolationError extends Error {
  /**
   * Creates expected policy violation.
   *
   * @param message - safe rejection explanation
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'LinkedWorktreeViolationError';
  }
}

//region Linked worktree enforcement entry

/**
 * Rejects state-changing guarded commands unless effective working directory
 * is a linked git worktree root. This covers all `git stash`, non-dry-run
 * `git clean`, and destructive `git reset` modes (`--hard`, `--merge`,
 * `--keep`). Per-subcommand optique parsers model long-option abbreviations
 * and option arity, so neither the destructiveness decision nor the
 * wrapper-only escape hatch can be bypassed by abbreviations or by hiding
 * the escape hatch in a value position.
 *
 * Worktree classification is delegated to {@link classifyEffectiveTarget},
 * which replays the caller's pre-subcommand region and inherited environment
 * against real git's `rev-parse` so `--git-dir`, `--work-tree`, `GIT_DIR`,
 * and `GIT_WORK_TREE` cannot make the wrapper validate one worktree while the
 * destructive command operates on another.
 *
 * Subcommand location comes from {@link parseGlobalOptions} and per-command
 * facts from {@link computeRegion}; the escape hatch is stripped by
 * {@link stripEscapeHatch}, and rejections are rendered by
 * {@link outsideWorktreeMessage} and {@link mainWorktreeMessage}.
 *
 * @param args - Git argv to inspect after wrapper invocation.
 *
 * @returns Original argv when command is unguarded, linked-worktree-safe, or
 *   targets a baked-in allowlisted tool-cache directory; argv with
 *   flag-position `--no-enforce-worktree` stripped when escape hatch is in use.
 *
 * @throws When guarded state-changing invocation is requested outside a
 *   linked git worktree.
 *
 * @example
 * ```ts
 * await checkLinkedWorktree(['-C', '/repo-linked', 'stash']);
 * // passes when real git reports /repo-linked is a linked worktree
 *
 * await checkLinkedWorktree(['-C', '/repo-main', 'clean', '-fd']);
 * // throws when /repo-main is the main worktree
 *
 * await checkLinkedWorktree(['-C', '/repo-main', 'clean', '-ndX']);
 * // passes because dry-run clean does not delete files
 * ```
 */
export async function checkLinkedWorktree(
  args: readonly string[],
): Promise<readonly string[]> {
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

  if (subcommand === undefined)
    return args;

  if (!isGuardedCommand(subcommand,))
    return args;

  /**
   * Tagged logger for the linked-worktree-only rule.
   */
  const rl = tagged({
    tag: checkLinkedWorktree.name,
    l,
  },);

  /**
   * Slice of args strictly after guarded subcommand.
   */
  const postSubcommandArgs = args.slice(subcommandIndex + 1,);
  /**
   * Facts about the post-subcommand region produced by optique.
   */
  const region = computeRegion({
    subcommand,
    postSubcommandArgs,
  },);

  if (region.hasEscapeHatch) {
    rl.debug(
      '--no-enforce-worktree present in flag position, stripping and skipping linked-worktree check',
    );
    return stripEscapeHatch({
      args,
      subcommandIndex,
      separateValueOptions: region.separateValueOptions,
    },);
  }

  if (!region.changesWorktree)
    return args;

  rl.debug(`effective cwd: ${effectiveCwd}, subcommand: ${subcommand}`,);

  /**
   * Pre-subcommand argv that captures the caller's repo-selection layer.
   */
  const preSubcommandArgs = args.slice(
    0,
    subcommandIndex,
  );
  /**
   * Worktree classification driven by real git replaying the caller's repo selection.
   */
  const target: EffectiveTarget = await classifyEffectiveTarget({
    preSubcommandArgs,
    effectiveCwd,
  },);

  if (target === 'outside-worktree')
    throw new LinkedWorktreeViolationError(outsideWorktreeMessage({ command: subcommand, },),);

  if (target === 'main-worktree')
    throw new LinkedWorktreeViolationError(mainWorktreeMessage({ command: subcommand, },),);

  rl.debug(`effective target ${target}; linked-worktree enforcement not triggered`,);
  return args;
}

//endregion Linked worktree enforcement entry
