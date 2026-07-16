import {
  PATHSPEC_SEPARATOR,
  WORKTREE_ENFORCEMENT_ESCAPE_HATCH,
} from '../escape-hatch.ts';
import {
  ARGV_REFUSED,
  type ArgvSpec,
  tryParseArgv,
} from './argv.ts';

//region Stash post-subcommand region parser

/**
 * Declared option surface of the post-`stash` argv region.
 *
 * Models the value-taking options `-m`/`--message` and `--pathspec-from-file`
 * so the wrapper-only escape-hatch token cannot be misread when it appears in
 * the value position. Every other stash option stays undeclared because the
 * policy treats every stash form as worktree-changing regardless of the other
 * flags.
 */
const stashRegionSpec: ArgvSpec = {
  flags: { escape: { names: [WORKTREE_ENFORCEMENT_ESCAPE_HATCH,], }, },
  valueOptions: {
    message: { names: [
      '-m',
      '--message',
    ], },
    pathspecFromFile: { names: ['--pathspec-from-file',], },
  },
};

//endregion Stash post-subcommand region parser

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
   * Parsed facts over the cleaned option region, or refusal.
   */
  const parsed = tryParseArgv({
    args: region,
    spec: stashRegionSpec,
  },);

  if (parsed === ARGV_REFUSED) {
    return {
      hasEscapeHatch: false,
      parseFailed: true,
    };
  }

  return {
    hasEscapeHatch: (parsed.flagCounts
      .escape
      ?? 0)
      > 0,
    parseFailed: false,
  };
}

//endregion Stash region facts derived from optique parse
