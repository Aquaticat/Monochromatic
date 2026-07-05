/**
 * Shell wrapper removal for terminal title command summaries.
 *
 * @module
 */

import {
  ENV_OPTIONS_WITH_ARGUMENT,
  isAssignmentToken,
  NICE_OPTIONS_WITH_ARGUMENT,
  skipWrapperOption,
  TIMEOUT_OPTIONS_WITH_ARGUMENT,
} from './command-options.ts';
import {
  type CommandTokens,
  wrappedTokensFromArgs,
} from './command-tokens.ts';

//region Wrapper constants

/**
 * Shell wrapper command names whose own invocation is title noise.
 */
const WRAPPER_COMMAND_NAMES: ReadonlySet<string> = new Set([
  'env',
  'nice',
  'nohup',
  'timeout',
],);

//endregion Wrapper constants

//region Wrapper implementations

/**
 * Unwraps an `env` command into its wrapped command tokens.
 *
 * @param tokens - because `env` owns option and assignment prefixes
 *
 * @returns wrapped command tokens or undefined when no command remains
 *
 * @example
 * ```ts
 * unwrapEnv({ name: 'env', args: ['FOO=1', 'npm', 'test'] });
 * // { name: 'npm', args: ['test'] }
 * ```
 */
function unwrapEnv(tokens: CommandTokens,): CommandTokens | undefined {
  /**
   * Cursor over env arguments before wrapped command.
   */
  let cursor = 0;
  while (cursor < tokens.args.length) {
    /**
     * Current env argument token.
     */
    const token = tokens.args[cursor];
    if (token === undefined)
      return undefined;
    if (isAssignmentToken(token,)) {
      cursor += 1;
      continue;
    }
    if (token.startsWith('-',)) {
      cursor = skipWrapperOption({
        args: tokens.args,
        cursor,
        optionsWithArgument: ENV_OPTIONS_WITH_ARGUMENT,
      },);
      continue;
    }
    return wrappedTokensFromArgs({
      args: tokens.args,
      cursor,
    },);
  }
  return undefined;
}

/**
 * Unwraps a `nice` command into its wrapped command tokens.
 *
 * @param tokens - because `nice` priority flags are title noise
 *
 * @returns wrapped command tokens or undefined when no command remains
 *
 * @example
 * ```ts
 * unwrapNice({ name: 'nice', args: ['-n', '5', 'npm', 'test'] });
 * // { name: 'npm', args: ['test'] }
 * ```
 */
function unwrapNice(tokens: CommandTokens,): CommandTokens | undefined {
  /**
   * Cursor over nice arguments before wrapped command.
   */
  let cursor = 0;
  while (cursor < tokens.args.length) {
    /**
     * Current nice argument token.
     */
    const token = tokens.args[cursor];
    if (token === undefined)
      return undefined;
    if (token.startsWith('-',)) {
      cursor = skipWrapperOption({
        args: tokens.args,
        cursor,
        optionsWithArgument: NICE_OPTIONS_WITH_ARGUMENT,
      },);
      continue;
    }
    return wrappedTokensFromArgs({
      args: tokens.args,
      cursor,
    },);
  }
  return undefined;
}

/**
 * Unwraps a `timeout` command into its wrapped command tokens.
 *
 * @param tokens - because duration and signal policy are title noise
 *
 * @returns wrapped command tokens or undefined when no command remains
 *
 * @example
 * ```ts
 * unwrapTimeout({ name: 'timeout', args: ['10', 'npm', 'test'] });
 * // { name: 'npm', args: ['test'] }
 * ```
 */
function unwrapTimeout(tokens: CommandTokens,): CommandTokens | undefined {
  /**
   * Cursor over timeout options and duration.
   */
  let cursor = 0;
  while (cursor < tokens.args.length) {
    /**
     * Current timeout argument token.
     */
    const token = tokens.args[cursor];
    if (token === undefined)
      return undefined;
    if (token.startsWith('-',)) {
      cursor = skipWrapperOption({
        args: tokens.args,
        cursor,
        optionsWithArgument: TIMEOUT_OPTIONS_WITH_ARGUMENT,
      },);
      continue;
    }
    return wrappedTokensFromArgs({
      args: tokens.args,
      cursor: cursor + 1,
    },);
  }
  return undefined;
}

/**
 * Unwraps one recognized wrapper command.
 *
 * @param tokens - because wrappers should not dominate command titles
 *
 * @returns wrapped command tokens or undefined when tokens are not a wrapper
 *
 * @example
 * ```ts
 * unwrapWrapper({ name: 'nohup', args: ['npm', 'test'] });
 * // { name: 'npm', args: ['test'] }
 * ```
 */
function unwrapWrapper(tokens: CommandTokens,): CommandTokens | undefined {
  if (tokens.name === 'env')
    return unwrapEnv(tokens,);
  if (tokens.name === 'nice')
    return unwrapNice(tokens,);
  if (tokens.name === 'timeout')
    return unwrapTimeout(tokens,);
  if (tokens.name === 'nohup') {
    return wrappedTokensFromArgs({
      args: tokens.args,
      cursor: 0,
    },);
  }
  return undefined;
}

//endregion Wrapper implementations

//region Public wrapper API

/**
 * Removes leading shell wrappers from parsed command tokens.
 *
 * @param tokens - because users care about meaningful work, not wrapper mechanics
 *
 * @returns innermost meaningful command tokens
 *
 * @example
 * ```ts
 * unwrapCommandTokens({ name: 'timeout', args: ['10', 'npm', 'test'] });
 * // { name: 'npm', args: ['test'] }
 * ```
 */
function unwrapCommandTokens(tokens: CommandTokens,): CommandTokens {
  /**
   * Current command tokens after each wrapper removal.
   */
  let current = tokens;
  while (WRAPPER_COMMAND_NAMES.has(current.name,)) {
    /**
     * Next wrapped command tokens.
     */
    const next = unwrapWrapper(current,);
    if (next === undefined)
      return current;
    current = next;
  }
  return current;
}

//endregion Public wrapper API

export { unwrapCommandTokens, };
