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

import { PATHSPEC_SEPARATOR, } from '../escape-hatch.ts';

//region Add escape hatch constants

/**
 * Wrapper-only flag that suppresses bulk-add enforcement for one invocation.
 */
export const ADD_ESCAPE_HATCH = '--no-enforce-bulk-add';

//endregion Add escape hatch constants

//region Add post-subcommand optique parser

/**
 * Bulk-staging tokens that match every changed path under the cwd or repo.
 * Each is rejected by the wrapper unless the escape hatch is also present.
 */
const BULK_TOKENS: ReadonlySet<string> = new Set([
  '.',
  './',
  '*',
  ':/',
  '-A',
  '--all',
  '-u',
  '--update',
],);

/**
 * Bulk pathspec tokens that remain broad after `--` turns later tokens into pathspecs instead of options.
 */
const BULK_PATHSPEC_TOKENS: ReadonlySet<string> = new Set([
  '.',
  './',
  '*',
  ':/',
],);

/**
 * Optique parser for the post-`add` argv region.
 *
 * Models the value-taking `--pathspec-from-file <file>` and the wrapper-only
 * escape hatch so the bulk-pattern walk that follows can safely skip the
 * value position. Plain pathspecs are captured by `argument()` so the
 * positional list mirrors what real git would see.
 */
const addRegionParser = object({
  pathspecFromFile: optional(option(
    '--pathspec-from-file',
    string(),
  ),),
  escape: multiple(flag(ADD_ESCAPE_HATCH,),),
  positionals: multiple(
    argument(string(),),
  ),
  unknownOptions: passThrough({ format: 'nextToken', },),
},);

//endregion Add post-subcommand optique parser

//region Add region facts

/**
 * Facts about the post-`add` argv region used by add-explicit policy.
 */
export type AddRegion = {
  /**
   * Literal bulk-staging tokens that appear in option or pathspec positions.
   */
  readonly bulkMatches: readonly string[];
  /**
   * True when wrapper-only escape hatch appears as a real flag.
   */
  readonly hasEscapeHatch: boolean;
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
 * optionRegion(['-A', '--', 'file']);
 * // => ['-A']
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
 * Splits `args` at the {@link PATHSPEC_SEPARATOR} and returns only pathspecs after it.
 *
 * @param args - Post-subcommand argv tokens.
 *
 * @returns Argv slice strictly after `--`, or an empty slice when absent.
 *
 * @example
 * ```ts
 * pathspecRegion(['--', '.']);
 * // => ['.']
 * ```
 */
function pathspecRegion(args: readonly string[],): readonly string[] {
  /**
   * Position of pathspec separator inside post-subcommand region.
   */
  const separatorIndex = args.indexOf(PATHSPEC_SEPARATOR,);

  if (separatorIndex === (-1))
    return [];

  return args.slice(separatorIndex + 1,);
}

/**
 * Options for the bulk-pattern scan.
 */
type BulkScanOptions = {
  /**
   * Argv slice being scanned for broad git add tokens.
   */
  readonly region: readonly string[];
  /**
   * Index where scanning resumes.
   */
  readonly index: number;
  /**
   * Accumulated literal bulk-pattern matches.
   */
  readonly matches: readonly string[];
  /**
   * Tokens considered broad in the current argv region.
   */
  readonly bulkTokens: ReadonlySet<string>;
  /**
   * True when `--pathspec-from-file` consumes the next token as an option value.
   */
  readonly skipPathspecFromFileValues: boolean;
};

/**
 * Recursive scanner that collects bulk-staging tokens while optionally
 * skipping the value position of `--pathspec-from-file <value>` so the wrapper
 * does not misread a pathspec-file value as a bulk-staging pattern.
 *
 * @param region - Argv slice being scanned.
 *
 * @param index - Current scan position.
 *
 * @param matches - Bulk-pattern tokens collected so far.
 *
 * @param bulkTokens - Tokens considered broad in this region.
 *
 * @param skipPathspecFromFileValues - Whether `--pathspec-from-file` consumes
 *   the next token as an option value.
 *
 * @returns Literal bulk-pattern matches in argv order.
 *
 * @example
 * ```ts
 * scanBulkTokens({
 *   region: ['-A', '--pathspec-from-file', '-A'],
 *   index: 0,
 *   matches: [],
 *   bulkTokens: BULK_TOKENS,
 *   skipPathspecFromFileValues: true,
 * });
 * // => ['-A']
 * ```
 */
function scanBulkTokens({
  region,
  index,
  matches,
  bulkTokens,
  skipPathspecFromFileValues,
}: BulkScanOptions,): readonly string[] {
  /**
   * Current argv token at scan position.
   */
  const arg = region[index];

  if (arg === undefined)
    return matches;

  if (skipPathspecFromFileValues && (arg === '--pathspec-from-file')) {
    return scanBulkTokens({
      region,
      index: index + 2,
      matches,
      bulkTokens,
      skipPathspecFromFileValues,
    },);
  }

  if (skipPathspecFromFileValues && arg
    .startsWith('--pathspec-from-file=',)) {
    return scanBulkTokens({
      region,
      index: index + 1,
      matches,
      bulkTokens,
      skipPathspecFromFileValues,
    },);
  }

  if (bulkTokens.has(arg,)) {
    return scanBulkTokens({
      region,
      index: index + 1,
      matches: [
        ...matches,
        arg,
      ],
      bulkTokens,
      skipPathspecFromFileValues,
    },);
  }

  return scanBulkTokens({
    region,
    index: index + 1,
    matches,
    bulkTokens,
    skipPathspecFromFileValues,
  },);
}

/**
 * Parses the post-`add` argv region into a structured fact set used by the
 * add-explicit rule. Splits the region with {@link optionRegion} and
 * {@link pathspecRegion}, detects the wrapper-only escape hatch via optique
 * (option-arity-aware), and collects literal bulk-staging tokens via
 * {@link scanBulkTokens}, a small value-aware walker.
 *
 * @param postSubcommandArgs - Arguments strictly after `add` subcommand.
 *
 * @returns Fact record consumed by add-explicit policy.
 *
 * @example
 * ```ts
 * parseAddRegion(['-A']).bulkMatches;
 * // => ['-A']
 * ```
 */
export function parseAddRegion(
  postSubcommandArgs: readonly string[],
): AddRegion {
  /**
   * Argv slice handed to optique; pathspec region is excluded.
   */
  const optionArgs = optionRegion(postSubcommandArgs,);
  /**
   * Pathspecs after `--`; broad pathspecs here still stage many files.
   */
  const pathspecArgs = pathspecRegion(postSubcommandArgs,);

  /**
   * Optique parse result over the option region; the only fact taken from optique is the escape-hatch presence.
   */
  const parseResult = parseSync(
    addRegionParser,
    optionArgs,
  );
  /**
   * Whether wrapper-only escape hatch appears in flag position.
   */
  const hasEscapeHatch = (parseResult.success)
    && (parseResult.value
      .escape
      .length
      > 0);

  /**
   * Literal bulk-staging tokens detected by the value-aware scan.
   */
  const bulkMatches = [
    ...scanBulkTokens({
      region: optionArgs,
      index: 0,
      matches: [],
      bulkTokens: BULK_TOKENS,
      skipPathspecFromFileValues: true,
    },),
    ...scanBulkTokens({
      region: pathspecArgs,
      index: 0,
      matches: [],
      bulkTokens: BULK_PATHSPEC_TOKENS,
      skipPathspecFromFileValues: false,
    },),
  ];

  return {
    bulkMatches,
    hasEscapeHatch,
  };
}

//endregion Add region facts
