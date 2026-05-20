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

//region Commit escape hatch + inline-value normalization

/** Wrapper-only flag that suppresses `-o` injection for one commit invocation. */
export const COMMIT_ESCAPE_HATCH = '--no-enforce-only';

/**
 * Short options whose clustered form can carry the value in the same argv
 * token (e.g. `-mhello`). Used by the inline normaliser to split such tokens
 * into the canonical separated form before optique parsing, since optique's
 * built-in `option()` only recognises `-m value` and `--option=value`.
 */
const SHORT_VALUE_OPTIONS: ReadonlySet<string> = new Set([
  '-m',
  '-F',
  '-C',
  '-c',
  '-t',
  '-U',
],);

/**
 * Splits short-option clusters that carry the value inline so the canonical
 * `-m value` shape reaches optique. Tokens like `-mhello` become
 * `['-m', 'hello']`; tokens like `-amhello` become `['-a', '-m', 'hello']`
 * because git treats the trailing `m` as a value-taking short option.
 *
 * @param token - Candidate argv token.
 *
 * @returns Token rewritten into canonical separated form, or single-element
 *   tuple when no rewrite applies.
 *
 * @example
 * ```ts
 * normaliseInlineShort('-mhello');
 * // => ['-m', 'hello']
 * ```
 */
function normaliseInlineShort(token: string,): readonly string[] {
  if (!token.startsWith('-',) || token.startsWith('--',) || token.length <= 2)
    return [token,];

  /** Index of the first value-taking short option inside the cluster. */
  const valueIndex = findValueOptionIndex(token,);

  if (valueIndex === (-1))
    return [token,];

  /** Leading boolean short options (e.g. `a` from `-am`). */
  const leading = token.slice(1, valueIndex,);
  /** Value-taking short option spelled with leading dash. */
  const valueOption = `-${token.slice(valueIndex, valueIndex + 1,)}`;
  /** Inline value text that follows the value-taking option letter. */
  const inlineValue = token.slice(valueIndex + 1,);

  /* oxlint-disable unicorn/prefer-spread -- leading is ASCII short-option letters (constrained by SHORT_VALUE_OPTIONS), so code-point iteration here is correct and equivalent to grapheme iteration. */
  /** Cluster letters split into individual short-option characters. */
  const leadingLetters = Array.from(leading,);
  /* oxlint-enable unicorn/prefer-spread */
  /** Boolean short options split back into single-letter tokens. */
  const leadingTokens = leadingLetters.map(function asShort(letter,) {
    return `-${letter}`;
  },);

  if (inlineValue === '') {
    return [
      ...leadingTokens,
      valueOption,
    ];
  }

  return [
    ...leadingTokens,
    valueOption,
    inlineValue,
  ];
}

/**
 * Locates the first value-taking short option inside a cluster.
 *
 * @param token - Short-option cluster token.
 *
 * @returns Index of the value-taking option letter, or -1.
 *
 * @example
 * ```ts
 * findValueOptionIndex('-am');
 * // => 2
 * ```
 */
function findValueOptionIndex(token: string,): number {
  for (let i = 1; i < token.length; i += 1) {
    if (SHORT_VALUE_OPTIONS.has(`-${token[i]}`,))
      return i;
  }
  return -1;
}

/**
 * Walks the post-`commit` argv and rewrites every inline short-cluster that
 * carries a value into the canonical separated form. Tokens past the
 * pathspec separator are preserved verbatim.
 *
 * @param args - Post-subcommand argv tokens.
 *
 * @returns Argv with inline values normalised.
 *
 * @example
 * ```ts
 * normaliseCommitArgs(['-amhello', 'file.ts']);
 * // => ['-a', '-m', 'hello', 'file.ts']
 * ```
 */
function normaliseCommitArgs(args: readonly string[],): readonly string[] {
  /** Index of the pathspec separator inside the post-subcommand region. */
  const separatorIndex = args.indexOf(PATHSPEC_SEPARATOR,);
  /** Argv slice subject to normalisation; pathspecs past `--` are preserved. */
  const optionRegion = separatorIndex === (-1) ? args : args.slice(0, separatorIndex,);
  /** Pathspec tail kept verbatim, including the leading `--` separator. */
  const pathspecTail = separatorIndex === (-1) ? [] : args.slice(separatorIndex,);

  return [
    ...optionRegion.flatMap(function normalise(token,) {
      return normaliseInlineShort(token,);
    },),
    ...pathspecTail,
  ];
}

//endregion Commit escape hatch + inline-value normalization

//region Commit post-subcommand optique parser

/**
 * Optique parser for the post-`commit` argv region.
 *
 * Declares the flags and value-taking options the commit-only rule needs to
 * decide whether to inject `-o` and whether the invocation supplies a
 * pathspec. Plain pathspecs are captured by `argument()`; unknown options
 * are captured by `passThrough({ format: 'nextToken' })`.
 */
const commitRegionParser = object({
  allFlags: multiple(flag('-a', '--all',),),
  explicitOnlyFlags: multiple(flag('-o', '--only',),),
  noOnlyFlags: multiple(flag('--no-only',),),
  amendFlags: multiple(flag('--amend',),),
  allowEmptyFlags: multiple(flag('--allow-empty',),),
  message: optional(option('-m', '--message', string(),),),
  file: optional(option('-F', '--file', string(),),),
  reuseMessage: optional(option('-C', '--reuse-message', string(),),),
  reeditMessage: optional(option('-c', '--reedit-message', string(),),),
  squash: optional(option('--squash', string(),),),
  fixup: optional(option('--fixup', string(),),),
  author: optional(option('--author', string(),),),
  date: optional(option('--date', string(),),),
  cleanup: optional(option('--cleanup', string(),),),
  trailer: multiple(option('--trailer', string(),),),
  template: optional(option('-t', '--template', string(),),),
  unified: optional(option('-U', '--unified', string(),),),
  interHunkContext: optional(option('--inter-hunk-context', string(),),),
  pathspecFromFile: optional(option('--pathspec-from-file', string(),),),
  escape: multiple(flag(COMMIT_ESCAPE_HATCH,),),
  positionals: multiple(argument(string(),),),
  unknownOptions: passThrough({ format: 'nextToken', },),
},);

//endregion Commit post-subcommand optique parser

//region Commit region facts

/** Facts about the post-`commit` argv region used by commit-only policy. */
export type CommitRegion = {
  /** Whether argv asks git to stage every tracked modification before committing. */
  readonly hasAllFlag: boolean;
  /** Whether argv explicitly enables or disables only mode. */
  readonly hasExplicitOnlyFlag: boolean;
  /** Whether argv explicitly disables only mode (`--no-only`). */
  readonly hasNoOnlyFlag: boolean;
  /** Whether argv includes a mode where git permits no positional pathspec. */
  readonly hasPathlessAllowedFlag: boolean;
  /** Whether argv asks git to read pathspecs from file or stdin. */
  readonly hasPathspecFromFile: boolean;
  /** Whether argv includes at least one positional pathspec (before or after `--`). */
  readonly hasPathspec: boolean;
  /** Whether wrapper-only escape hatch appears as a real flag. */
  readonly hasEscapeHatch: boolean;
};

/**
 * Parses the post-`commit` argv region into a structured fact set used by
 * the commit-only rule. Inline short-cluster values are normalised before
 * optique parsing so `-mhello` and `-mhello file.ts` are interpreted the
 * same way real git would. Pathspecs after `--` are detected by scanning
 * the verbatim tail.
 *
 * @param postSubcommandArgs - Arguments strictly after `commit` subcommand.
 *
 * @returns Fact record consumed by commit-only policy.
 *
 * @example
 * ```ts
 * parseCommitRegion(['-am', 'hello']).hasAllFlag;
 * // => true
 * ```
 */
export function parseCommitRegion(
  postSubcommandArgs: readonly string[],
): CommitRegion {
  /** Normalised argv where inline short-cluster values are split apart. */
  const normalised = normaliseCommitArgs(postSubcommandArgs,);
  /** Position of pathspec separator after normalisation. */
  const separatorIndex = normalised.indexOf(PATHSPEC_SEPARATOR,);
  /** Argv slice handed to optique; pathspec region is excluded. */
  const region = separatorIndex === (-1)
    ? normalised
    : normalised.slice(0, separatorIndex,);
  /** Pathspec slice after `--`; every token here is a pathspec. */
  const pathspecAfterSeparator = separatorIndex === (-1)
    ? []
    : normalised.slice(separatorIndex + 1,);

  /** Optique parse result over the cleaned option region. */
  const parseResult = parseSync(commitRegionParser, region,);

  if (!parseResult.success) {
    return {
      hasAllFlag: false,
      hasExplicitOnlyFlag: false,
      hasNoOnlyFlag: false,
      hasPathlessAllowedFlag: false,
      hasPathspecFromFile: false,
      hasPathspec: false,
      hasEscapeHatch: false,
    };
  }

  /** Successful parse value with optique-inferred shape. */
  const { value, } = parseResult;
  /** Sum of explicit only-mode flag occurrences (`-o`, `--only`, `--no-only`). */
  const explicitOnlyCount = value.explicitOnlyFlags.length + value.noOnlyFlags.length;
  /** Sum of pathless-allowed flag occurrences (`--amend`, `--allow-empty`). */
  const pathlessAllowedCount = value.amendFlags.length + value.allowEmptyFlags.length;

  return {
    hasAllFlag: value.allFlags.length > 0,
    hasExplicitOnlyFlag: explicitOnlyCount > 0,
    hasNoOnlyFlag: value.noOnlyFlags.length > 0,
    hasPathlessAllowedFlag: pathlessAllowedCount > 0,
    hasPathspecFromFile: value.pathspecFromFile !== undefined,
    hasPathspec: value.positionals.length > 0 || pathspecAfterSeparator.length > 0,
    hasEscapeHatch: value.escape.length > 0,
  };
}

//endregion Commit region facts
