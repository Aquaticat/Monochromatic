/**
 * Shell command token model for terminal title summaries.
 *
 * @module
 */

import type { ShellCommandInfo, } from '@monochromatic-dev/agent-harness-shared-shell-command-analyzer/ts';

//region Token model

/**
 * Sentinel returned when wrapper arguments do not contain a wrapped command.
 */
const COMMAND_TOKENS_MISSING: unique symbol = Symbol('terminal-title/command-tokens-missing',);

/**
 * Parsed command token sequence used for title summarization.
 */
type CommandTokens = {
  /**
   * Command name.
   */
  readonly name: string;

  /**
   * Command arguments.
   */
  readonly args: readonly string[];
};

/**
 * Converts analyzer command information to title token sequence.
 *
 * @param info - because analyzer owns shell parsing
 *
 * @returns command tokens for title summarization
 *
 * @example
 * ```ts
 * commandTokensFromInfo(info);
 * ```
 */
function commandTokensFromInfo(info: ShellCommandInfo,): CommandTokens {
  return {
    name: info.name,
    args: info.args,
  };
}

/**
 * Formats command tokens for title display.
 *
 * @param tokens - because command name and args share title output
 *
 * @returns command summary string
 *
 * @example
 * ```ts
 * formatCommandTokens({ name: 'npm', args: ['test'] });
 * // 'npm test'
 * ```
 */
function formatCommandTokens(tokens: CommandTokens,): string {
  return [
    tokens.name,
    ...tokens.args,
  ].join(' ',);
}

/**
 * Builds command tokens from wrapper arguments at cursor.
 *
 * @param args - because wrapper command passes remaining tokens as wrapped command
 *
 * @param cursor - because wrapper-specific parsing determines where command starts
 *
 * @returns wrapped command tokens or undefined when no command remains
 *
 * @example
 * ```ts
 * wrappedTokensFromArgs({ args: ['npm', 'test'], cursor: 0 });
 * // { name: 'npm', args: ['test'] }
 * ```
 */
function wrappedTokensFromArgs(
  {
    args,
    cursor,
  }: Readonly<{
    args: readonly string[];
    cursor: number;
  }>,
): CommandTokens | typeof COMMAND_TOKENS_MISSING {
  /**
   * Wrapped command name.
   */
  const name = args[cursor];
  if (name === undefined)
    return COMMAND_TOKENS_MISSING;
  return {
    name,
    args: args.slice(cursor + 1,),
  };
}

//endregion Token model

export {
  COMMAND_TOKENS_MISSING,
  commandTokensFromInfo,
  formatCommandTokens,
  wrappedTokensFromArgs,
};

export type { CommandTokens, };
