import { object, } from '@optique/core/constructs';
import {
  multiple,
  optional,
} from '@optique/core/modifiers';
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

//region Stash post-subcommand optique parser

/**
 * Optique parser for the post-`stash` argv region.
 *
 * Models the value-taking options `-m`/`--message` and `--pathspec-from-file`
 * so the wrapper-only escape-hatch token cannot be misread when it appears in
 * the value position. Every other stash option is captured by passthrough
 * because the policy treats every stash form as worktree-changing regardless
 * of the other flags.
 */
const stashRegionParser = object({
  message: optional(option(
    '-m',
    '--message',
    string(),
  ),),
  pathspecFromFile: optional(option(
    '--pathspec-from-file',
    string(),
  ),),
  escape: multiple(flag(WORKTREE_ENFORCEMENT_ESCAPE_HATCH,),),
  positionals: multiple(
    argument(string(),),
  ),
  unknownOptions: passThrough({ format: 'nextToken', },),
},);

//endregion Stash post-subcommand optique parser

//region Stash region facts derived from optique parse

/**
 * Facts about the post-`stash` argv region used by linked-worktree policy.
 */
export type StashRegion = {
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
 * Splits `args` at the {@link PATHSPEC_SEPARATOR} and returns only the option region.
 *
 * @param args - Post-subcommand argv tokens.
 *
 * @returns Argv slice strictly before `--`.
 *
 * @example
 * ```ts
 * optionRegion(['push', '--', 'file']);
 * // => ['push']
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
 * Parses the post-`stash` argv region into a structured fact set used by the
 * linked-worktree rule. Splits the region with {@link optionRegion}; the
 * arity-aware optique scan closes the escape-hatch confusion shape where the
 * token appears as the value of `-m <message>`, `--message <message>`, or
 * `--pathspec-from-file <file>`.
 *
 * @param postSubcommandArgs - Arguments strictly after `stash` subcommand.
 *
 * @returns Fact record consumed by stash-worktree policy.
 *
 * @example
 * ```ts
 * parseStashRegion(['push', '-m', '--no-enforce-worktree']).hasEscapeHatch;
 * // => false (token is the message value, not a wrapper-only flag)
 * ```
 */
export function parseStashRegion(
  postSubcommandArgs: readonly string[],
): StashRegion {
  /**
   * Argv slice handed to optique; pathspec region is excluded.
   */
  const region = optionRegion(postSubcommandArgs,);

  /**
   * Optique parse result over the cleaned option region.
   */
  const parseResult = parseSync(
    stashRegionParser,
    region,
  );

  if (!parseResult.success) {
    return {
      hasEscapeHatch: false,
      parseFailed: true,
    };
  }

  /**
   * Successful parse value with optique-inferred shape.
   */
  const { value, } = parseResult;

  return {
    hasEscapeHatch: value.escape
      .length
      > 0,
    parseFailed: false,
  };
}

//endregion Stash region facts derived from optique parse
