/**
 * Shell wrapper option helpers for terminal title command summaries.
 *
 * @module
 */

//region Option constants

/**
 * `env` options that consume one following argument.
 */
const ENV_OPTIONS_WITH_ARGUMENT: ReadonlySet<string> = new Set([
  '-u',
  '--unset',
  '-C',
  '--chdir',
  '-S',
  '--split-string',
],);

/**
 * `nice` options that consume one following argument.
 */
const NICE_OPTIONS_WITH_ARGUMENT: ReadonlySet<string> = new Set([
  '-n',
  '--adjustment',
],);

/**
 * `timeout` options that consume one following argument.
 */
const TIMEOUT_OPTIONS_WITH_ARGUMENT: ReadonlySet<string> = new Set([
  '-s',
  '--signal',
  '-k',
  '--kill-after',
],);

/**
 * Generic long-option assignment delimiter.
 */
const LONG_OPTION_VALUE_DELIMITER: string = '=';

//endregion Option constants

//region Option helpers

/**
 * Checks whether token is a shell environment assignment.
 *
 * @param token - because `env FOO=bar cmd` should title as `cmd`
 *
 * @returns whether token looks like `NAME=value`
 *
 * @example
 * ```ts
 * isAssignmentToken('NODE_ENV=production');
 * // true
 * ```
 */
function isAssignmentToken(token: string,): boolean {
  return (!token.startsWith('-',))
    && token.includes(LONG_OPTION_VALUE_DELIMITER,);
}

/**
 * Checks whether long option token already carries its value.
 *
 * @param token - because `--signal=TERM` should not consume next token
 *
 * @returns whether token includes `=`
 *
 * @example
 * ```ts
 * hasInlineOptionValue('--signal=TERM');
 * // true
 * ```
 */
function hasInlineOptionValue(token: string,): boolean {
  return token.includes(LONG_OPTION_VALUE_DELIMITER,);
}

/**
 * Advances cursor past option argument when current option requires one.
 *
 * @param args - because wrapper option values should not be treated as commands
 *
 * @param cursor - because caller owns current token position
 *
 * @param optionsWithArgument - because each wrapper has distinct option grammar
 *
 * @returns next cursor after option and any separate option value
 *
 * @example
 * ```ts
 * skipWrapperOption({ args: ['-n', '5', 'npm'], cursor: 0, optionsWithArgument: new Set(['-n']) });
 * // 2
 * ```
 */
function skipWrapperOption(
  {
    args,
    cursor,
    optionsWithArgument,
  }: Readonly<{
    args: readonly string[];
    cursor: number;
    optionsWithArgument: ReadonlySet<string>;
  }>,
): number {
  /**
   * Option token being skipped.
   */
  const option = args[cursor];
  if (option === undefined)
    return cursor;
  /**
   * Cursor after option token itself.
   */
  const afterOption = cursor + 1;
  if (hasInlineOptionValue(option,))
    return afterOption;
  if (!optionsWithArgument.has(option,))
    return afterOption;
  if (afterOption >= args.length)
    return afterOption;
  return afterOption + 1;
}

//endregion Option helpers

export {
  ENV_OPTIONS_WITH_ARGUMENT,
  isAssignmentToken,
  NICE_OPTIONS_WITH_ARGUMENT,
  skipWrapperOption,
  TIMEOUT_OPTIONS_WITH_ARGUMENT,
};
