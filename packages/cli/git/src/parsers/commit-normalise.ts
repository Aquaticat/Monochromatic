import { PATHSPEC_SEPARATOR, } from '../escape-hatch.ts';

//region Commit inline-value normalization

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
 * Commit options that consume the following argv token in separated form.
 * Pathspec scanning skips these values so message text, templates, and
 * pathspec-file names are not mistaken for commit pathspecs. Optional-value
 * options where Git treats separated followers as pathspecs, such as `-S`
 * and `-u`, are intentionally absent.
 */
const SEPARATED_VALUE_OPTIONS: ReadonlySet<string> = new Set([
  ...SHORT_VALUE_OPTIONS,
  '--message',
  '--file',
  '--reuse-message',
  '--reedit-message',
  '--squash',
  '--fixup',
  '--author',
  '--date',
  '--cleanup',
  '--trailer',
  '--template',
  '--unified',
  '--inter-hunk-context',
  '--pathspec-from-file',
],);

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
  for (let loopIndex = 1; loopIndex < token
    .length; loopIndex += 1) {
    if (SHORT_VALUE_OPTIONS.has(`-${token[loopIndex]}`,))
      return loopIndex;
  }
  return -1;
}

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
  if ((!token.startsWith('-',)) || token
    .startsWith('--',)
    || (token
      .length
      <= 2))
    return [token,];

  /**
   * Index of the first value-taking short option inside the cluster.
   */
  const valueIndex = findValueOptionIndex(token,);

  if (valueIndex === (-1))
    return [token,];

  /**
   * Leading boolean short options (e.g. `a` from `-am`).
   */
  const leading = token.slice(
    1,
    valueIndex,
  );
  /**
   * Value-taking short option spelled with leading dash.
   */
  const valueOption = `-${
    token.slice(
      valueIndex,
      valueIndex + 1,
    )
  }`;
  /**
   * Inline value text that follows the value-taking option letter.
   */
  const inlineValue = token.slice(valueIndex + 1,);

  /* oxlint-disable unicorn/prefer-spread -- leading is ASCII short-option letters (constrained by SHORT_VALUE_OPTIONS), so code-point iteration here is correct and equivalent to grapheme iteration. */
  /**
   * Cluster letters split into individual short-option characters.
   */
  const leadingLetters = Array.from(leading,);
  /* oxlint-enable unicorn/prefer-spread */
  /**
   * Boolean short options split back into single-letter tokens.
   */
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
export function normaliseCommitArgs(args: readonly string[],): readonly string[] {
  /**
   * Index of the pathspec separator inside the post-subcommand region.
   */
  const separatorIndex = args.indexOf(PATHSPEC_SEPARATOR,);
  /**
   * Argv slice subject to normalisation; pathspecs past `--` are preserved.
   */
  const optionRegion = separatorIndex === (-1) ? args : args.slice(
    0,
    separatorIndex,
  );
  /**
   * Pathspec tail kept verbatim, including the leading `--` separator.
   */
  const pathspecTail = separatorIndex === (-1) ? [] : args.slice(separatorIndex,);

  return [
    ...optionRegion.flatMap(function normalise(token,) {
      return normaliseInlineShort(token,);
    },),
    ...pathspecTail,
  ];
}

//endregion Commit inline-value normalization

//region Commit pathspec scanning

/**
 * Options for scanning a commit option region for positional pathspecs.
 */
type ScanPathspecOptions = {
  /**
   * Normalised argv tokens before any pathspec separator.
   */
  readonly args: readonly string[];
  /**
   * Current scan position.
   */
  readonly index: number;
};

/**
 * Identifies tokens Git will parse as options in the pre-`--` region.
 * A lone `-` is a valid pathspec, so it is not option-like.
 *
 * @param arg - Token from normalised commit argv.
 *
 * @returns `true` when token begins an option form.
 *
 * @example
 * ```ts
 * isOptionLikeToken('-q');
 * // => true
 * ```
 */
function isOptionLikeToken(arg: string,): boolean {
  return (arg !== '-') && arg
    .startsWith('-',);
}

/**
 * Recursively scans the option region for the first token Git would treat as
 * a positional pathspec. Known separated-value options skip their value slot;
 * every other option-like token is no-value for scanner purposes so no-value
 * flags such as `-q` and `--dry-run` cannot swallow the following pathspec.
 *
 * @param args - Normalised argv tokens before any pathspec separator.
 *
 * @param index - Cursor position to inspect.
 *
 * @returns `true` when a positional pathspec appears before `--`.
 *
 * @example
 * ```ts
 * scanOptionRegionForPathspec({ args: ['-q', 'file.ts'], index: 0 });
 * // => true
 * ```
 */
function scanOptionRegionForPathspec({
  args,
  index,
}: ScanPathspecOptions,): boolean {
  /**
   * Current argv token under the scanner cursor.
   */
  const arg = args[index];

  if (arg === undefined)
    return false;

  if (SEPARATED_VALUE_OPTIONS.has(arg,)) {
    return scanOptionRegionForPathspec({
      args,
      index: index + 2,
    },);
  }

  if (isOptionLikeToken(arg,)) {
    return scanOptionRegionForPathspec({
      args,
      index: index + 1,
    },);
  }

  return true;
}

/**
 * Detects whether normalised commit argv supplies at least one pathspec.
 * Tokens after `--` are pathspecs by definition; tokens before `--` are
 * scanned with commit option arity so no-value flags do not consume paths.
 *
 * @param normalised - Normalised post-`commit` argv tokens.
 *
 * @returns `true` when commit argv has a pathspec source.
 *
 * @example
 * ```ts
 * hasCommitPathspec(['-q', 'file.ts']);
 * // => true
 * ```
 */
export function hasCommitPathspec(normalised: readonly string[],): boolean {
  /**
   * Position of pathspec separator after normalisation.
   */
  const separatorIndex = normalised.indexOf(PATHSPEC_SEPARATOR,);

  if (separatorIndex !== (-1))
    return normalised
      .length
      > (separatorIndex + 1);

  return scanOptionRegionForPathspec({
    args: normalised,
    index: 0,
  },);
}

//endregion Commit pathspec scanning
