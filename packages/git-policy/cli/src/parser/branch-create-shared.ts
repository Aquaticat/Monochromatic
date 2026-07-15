import { PATHSPEC_SEPARATOR, } from '../escape-hatch.ts';

//region Long-option abbreviation helpers

/**
 * Sentinel returned when argv token is not a long option.
 */
const NOT_LONG_OPTION: unique symbol = Symbol('argv token is not a long option');

/**
 * Options for testing a long option token against git's unique-abbreviation rules.
 */
export type LongOptionMatchOptions = {
  /**
   * Argv token to inspect.
   */
  readonly arg: string;
  /**
   * Canonical options that count as a match for the caller.
   */
  readonly canonicalOptions: ReadonlySet<string>;
  /**
   * Complete known long-option vocabulary for current subcommand.
   */
  readonly knownOptions: ReadonlySet<string>;
};

/**
 * Returns long-option name without any `=<value>` suffix.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns Long-option name, or sentinel when token is not a long option.
 *
 * @example
 * ```ts
 * longOptionName('--create=topic');
 * // => '--create'
 * ```
 */
function longOptionName(arg: string,): string | typeof NOT_LONG_OPTION {
  /**
   * Whether token cannot be a long option name.
   */
  const notLongOption = (!arg.startsWith('--',)) || (arg === PATHSPEC_SEPARATOR);

  if (notLongOption)
    return NOT_LONG_OPTION;

  /**
   * Position where a glued long-option value begins.
   */
  const equalsIndex = arg.indexOf('=',);

  if (equalsIndex === (-1))
    return arg;

  return arg.slice(
    0,
    equalsIndex,
  );
}

/**
 * Reports whether token names one of the caller's canonical long options,
 * accepting only unique abbreviations within current subcommand vocabulary.
 * Strips any glued `=<value>` suffix via {@link longOptionName} before matching.
 *
 * @param arg - Argv token to inspect.
 *
 * @param canonicalOptions - Canonical options that count as a match.
 *
 * @param knownOptions - Complete long-option vocabulary for current subcommand.
 *
 * @returns `true` when arg resolves uniquely to one canonical option.
 *
 * @example
 * ```ts
 * matchesLongOption({
 *   arg: '--cre',
 *   canonicalOptions: new Set(['--create']),
 *   knownOptions: new Set(['--create', '--conflict']),
 * });
 * // => true
 * ```
 */
export function matchesLongOption({
  arg,
  canonicalOptions,
  knownOptions,
}: LongOptionMatchOptions,): boolean {
  /**
   * Long-option name without any glued value.
   */
  const name = longOptionName(arg,);

  /**
   * Whether token did not provide a long-option name.
   */
  const missingLongOptionName = (typeof name) === 'symbol';

  if (missingLongOptionName)
    return false;

  /**
   * Known options that accept this token as a prefix.
   */
  const matchingOptions = [...knownOptions,]
    .filter(function optionStartsWithName(option,): boolean {
      return option.startsWith(name,);
    },);

  if (matchingOptions.length !== 1)
    return false;

  /**
   * Unique canonical option selected by git abbreviation rules.
   */
  const [matchingOption,] = matchingOptions;

  return (matchingOption !== undefined) && canonicalOptions.has(matchingOption,);
}

//endregion Long-option abbreviation helpers

//region Short-option helpers

/**
 * Options for testing whether a short-option cluster includes a flag.
 */
type ShortOptionOptions = {
  /**
   * Argv token to inspect.
   */
  readonly arg: string;
  /**
   * Single-character short option without leading dash.
   */
  readonly option: string;
};

/**
 * Reports whether token is a short-option cluster containing one option.
 *
 * @param arg - Argv token to inspect.
 *
 * @param option - Single-character short option without leading dash.
 *
 * @returns `true` when short option is present.
 *
 * @example
 * ```ts
 * hasShortOption({ arg: '-avv', option: 'a' });
 * // => true
 * ```
 */
export function hasShortOption({
  arg,
  option,
}: ShortOptionOptions,): boolean {
  /**
   * Whether token cannot be a short-option cluster.
   */
  const notShortOption = (!arg.startsWith('-',))
    || arg.startsWith('--',)
    || (arg === '-');

  if (notShortOption)
    return false;

  return arg
    .slice(1,)
    .includes(option,);
}

/**
 * Reports whether token is exactly a separated short option.
 *
 * @param arg - Argv token to inspect.
 *
 * @param option - Single-character short option without leading dash.
 *
 * @returns `true` when token is exactly `-${option}`.
 *
 * @example
 * ```ts
 * isExactShortOption({ arg: '-b', option: 'b' });
 * // => true
 * ```
 */
export function isExactShortOption({
  arg,
  option,
}: ShortOptionOptions,): boolean {
  return arg === `-${option}`;
}

/**
 * Reports whether token is positional argv rather than an option.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when token is branch name, start point, or pattern text.
 *
 * @example
 * ```ts
 * isPositionalToken('topic');
 * // => true
 * ```
 */
export function isPositionalToken(arg: string,): boolean {
  return !arg.startsWith('-',);
}

//endregion Short-option helpers
