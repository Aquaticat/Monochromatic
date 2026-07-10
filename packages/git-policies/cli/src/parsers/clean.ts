import { object, } from '@optique/core/constructs';
import { multiple, } from '@optique/core/modifiers';
import { parseSync, } from '@optique/core/parser';
import {
  argument,
  flag,
  option,
  passThrough,
} from '@optique/core/primitives';
import { string, } from '@optique/core/valueparser';

import {
  PATHSPEC_SEPARATOR,
  WORKTREE_ENFORCEMENT_ESCAPE_HATCH,
} from '../escape-hatch.ts';
import { scanCleanOptionOrder, } from './clean-option-order.ts';
import {
  DRY_RUN_ALIASES,
  EXCLUDE_ALIASES,
  INTERACTIVE_ALIASES,
  NO_DRY_RUN_ALIASES,
  NO_INTERACTIVE_ALIASES,
} from './clean-options.ts';

//region Clean post-subcommand optique parser

/**
 * Optique parser for the post-`clean` argv region.
 *
 * Declares every long option that influences destructiveness with all
 * accepted abbreviations, so git's unambiguous long-option prefix matching
 * can no longer bypass the wrapper guard. The `-e <pattern>` short form is
 * modelled with arity so the escape-hatch token cannot be misread when it
 * appears in the value position.
 */
const cleanRegionParser = object({
  dryRunFlags: multiple(flag(
    ...DRY_RUN_ALIASES,
    '-n',
  ),),
  noDryRunFlags: multiple(flag(...NO_DRY_RUN_ALIASES,),),
  interactiveFlags: multiple(flag(
    ...INTERACTIVE_ALIASES,
    '-i',
  ),),
  noInteractiveFlags: multiple(flag(...NO_INTERACTIVE_ALIASES,),),
  excludeValues: multiple(option(
    ...EXCLUDE_ALIASES,
    '-e',
    string(),
  ),),
  escape: multiple(flag(WORKTREE_ENFORCEMENT_ESCAPE_HATCH,),),
  positionals: multiple(
    argument(string(),),
  ),
  unknownOptions: passThrough({ format: 'nextToken', },),
},);

//endregion Clean post-subcommand optique parser

//region Clean region facts derived from optique parse

/**
 * Facts about the post-`clean` argv region used by linked-worktree policy.
 */
export type CleanRegion = {
  /**
   * Number of `--dry-run`/`-n` occurrences (any accepted abbreviation).
   */
  readonly dryRunCount: number;
  /**
   * Number of `--no-dry-run` occurrences (any accepted abbreviation).
   */
  readonly noDryRunCount: number;
  /**
   * Number of `--interactive`/`-i` occurrences (any accepted abbreviation).
   */
  readonly interactiveCount: number;
  /**
   * Number of `--no-interactive` occurrences (any accepted abbreviation).
   */
  readonly noInteractiveCount: number;
  /**
   * Final dry-run state after applying Git's left-to-right ordering.
   */
  readonly dryRunActive: boolean;
  /**
   * Final interactive state after applying Git's left-to-right ordering.
   */
  readonly interactiveActive: boolean;
  /**
   * True when wrapper-only escape hatch appears as a real flag.
   */
  readonly hasEscapeHatch: boolean;
  /**
   * True when optique parse failed; rule should be conservative.
   */
  readonly parseFailed: boolean;
};

/**
 * Splits `args` at the {@link PATHSPEC_SEPARATOR} and returns only the option
 * region. Tokens past `--` are pathspecs and never carry wrapper-relevant
 * options.
 *
 * @param args - Post-subcommand argv tokens.
 *
 * @returns Argv slice strictly before `--`.
 *
 * @example
 * ```ts
 * optionRegion(['-n', '--', 'file']);
 * // => ['-n']
 * ```
 */
function optionRegion(args: readonly string[],): readonly string[] {
  /**
   * Position of pathspec separator inside post-subcommand region.
   */
  const separatorIndex = args.indexOf(PATHSPEC_SEPARATOR,);

  if (separatorIndex === (-1))
    return args;

  return args.slice(
    0,
    separatorIndex,
  );
}

/**
 * Parses the post-`clean` argv region into a structured fact set used by the
 * linked-worktree rule. Splits the region with {@link optionRegion}, then the
 * parser walks it with arity awareness, so the wrapper-only escape hatch
 * cannot be confused with the value of `-e <pattern>` and unambiguous
 * long-option abbreviations are recognised exactly as git would interpret
 * them; {@link scanCleanOptionOrder} resolves Git's last-option-wins ordering
 * for dry-run and interactive state.
 *
 * Parse failures leave `parseFailed: true` so the linked-worktree rule can
 * default to a conservative enforcement decision.
 *
 * @param postSubcommandArgs - Arguments strictly after `clean` subcommand.
 *
 * @returns Fact record consumed by clean-worktree policy.
 *
 * @example
 * ```ts
 * parseCleanRegion(['--excl', 'pat', '--dry-run']);
 * // dryRunCount = 1, excludeValues drained, hasEscapeHatch = false
 * ```
 */
export function parseCleanRegion(
  postSubcommandArgs: readonly string[],
): CleanRegion {
  /**
   * Argv slice handed to optique; pathspec region is excluded.
   */
  const region = optionRegion(postSubcommandArgs,);

  /**
   * Optique parse result over the cleaned option region.
   */
  const parseResult = parseSync(
    cleanRegionParser,
    region,
  );

  if (!parseResult.success) {
    return {
      dryRunCount: 0,
      noDryRunCount: 0,
      interactiveCount: 0,
      noInteractiveCount: 0,
      dryRunActive: false,
      interactiveActive: false,
      hasEscapeHatch: false,
      parseFailed: true,
    };
  }

  /**
   * Successful parse value with optique-inferred shape.
   */
  const { value, } = parseResult;
  /**
   * Ordered dry-run and interactive state matching Git's last-option-wins behavior.
   */
  const orderedState = scanCleanOptionOrder(region,);

  return {
    dryRunCount: value.dryRunFlags
      .length,
    noDryRunCount: value.noDryRunFlags
      .length,
    interactiveCount: value.interactiveFlags
      .length,
    noInteractiveCount: value.noInteractiveFlags
      .length,
    dryRunActive: orderedState.dryRunActive,
    interactiveActive: orderedState.interactiveActive,
    hasEscapeHatch: value.escape
      .length
      > 0,
    parseFailed: false,
  };
}

//endregion Clean region facts derived from optique parse

//region Clean destructiveness policy

/**
 * Determines whether a `git clean` invocation can change worktree files.
 *
 * Interactive clean can delete selected paths when the final interactive mode
 * is active, so that form always enforces the guard. Otherwise the invocation
 * is destructive unless the final dry-run state is active.
 *
 * Conservative under parse failure: treats unknown cases as destructive so
 * the linked-worktree guard runs.
 *
 * @param region - Parsed clean region.
 *
 * @returns `true` when invocation can change worktree filesystem state.
 *
 * @example
 * ```ts
 * cleanChangesWorktree(parseCleanRegion(['-ndX']));
 * // => false (dry-run prevents deletion)
 * ```
 */
export function cleanChangesWorktree(region: CleanRegion,): boolean {
  if (region.parseFailed)
    return true;

  if (region.interactiveActive)
    return true;

  return !region.dryRunActive;
}

//endregion Clean destructiveness policy
