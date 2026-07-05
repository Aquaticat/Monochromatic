/**
 * Shell command shortening for terminal titles.
 *
 * @module
 */

//region Shell prefix model

/**
 * Wrapper commands stripped together with their following argument token.
 *
 * The behavior intentionally mirrors the historical terminal-title regex,
 * including wrappers such as `env timeout 5` leaving `5` as the next command.
 *
 * @example
 * ```ts
 * COMMAND_NOISE_WRAPPERS.has('timeout');
 * // true
 * ```
 */
const COMMAND_NOISE_WRAPPERS: ReadonlySet<string> = new Set([
  'timeout',
  'env',
  'nice',
  'nohup',
],);

/**
 * Checks whether a character is shell-boundary whitespace for prefix stripping.
 *
 * Only space and tab are recognized because these title inputs are command-line
 * strings from tool payloads,
 * not full shell source parsers.
 *
 * @param character - because cursor helpers need one shared whitespace rule
 *
 * @returns whether character is a space or tab
 *
 * @example
 * ```ts
 * isShellWhitespace(' ');
 * // true
 * ```
 */
function isShellWhitespace(character: string,): boolean {
  return (character === ' ') || (character === '\t');
}

/**
 * Finds the exclusive end offset of token starting at `at`.
 *
 * @param command - because token boundaries are found within this source string
 *
 * @param at - because caller owns current scan cursor
 *
 * @returns first whitespace offset at or after `at`,
 * or `command.length` when token reaches end of input
 *
 * @example
 * ```ts
 * findTokenEnd({ command: 'FOO=bar ls', at: 0 });
 * // 7
 * ```
 */
function findTokenEnd(
  {
    command,
    at,
  }: Readonly<{
    command: string;
    at: number;
  }>,
): number {
  /**
   * Cursor advanced until whitespace or end of string is reached.
   */
  let cursor = at;
  while ((cursor < command.length) && (!isShellWhitespace(command.charAt(cursor,),))) {
    cursor += 1;
  }
  return cursor;
}

/**
 * Skips shell-boundary whitespace from `at`.
 *
 * @param command - because whitespace is skipped within this source string
 *
 * @param at - because caller owns current scan cursor
 *
 * @returns first non-whitespace offset at or after `at`,
 * or `command.length` when only whitespace remains
 *
 * @example
 * ```ts
 * skipShellWhitespace({ command: 'FOO=bar ls', at: 7 });
 * // 8
 * ```
 */
function skipShellWhitespace(
  {
    command,
    at,
  }: Readonly<{
    command: string;
    at: number;
  }>,
): number {
  /**
   * Cursor advanced over the whitespace run.
   */
  let cursor = at;
  while ((cursor < command.length) && isShellWhitespace(command.charAt(cursor,),)) {
    cursor += 1;
  }
  return cursor;
}

/**
 * Finds the offset after all leading shell command noise.
 *
 * The scanner removes environment assignments such as `FOO=bar` and wrapper
 * command plus argument pairs such as `timeout 5`.
 * It is a single linear scan over leading tokens and preserves the historical
 * title behavior used by both terminal-title integrations.
 *
 * @param command - because Bash-like tool titles should emphasize meaningful work
 *
 * @returns offset where meaningful command text begins
 *
 * @example
 * ```ts
 * findCommandNoiseEnd('NODE_ENV=prod timeout 5 npm test');
 * // 24
 * ```
 */
function findCommandNoiseEnd(command: string,): number {
  /**
   * Cursor advanced past every stripped prefix.
   */
  let cursor = 0;
  while (cursor < command.length) {
    /**
     * End offset of candidate leading token.
     */
    const tokenEnd = findTokenEnd({
      command,
      at: cursor,
    },);
    if (tokenEnd === cursor)
      break;

    /**
     * Offset after whitespace following candidate token.
     */
    const afterTokenWhitespace = skipShellWhitespace({
      command,
      at: tokenEnd,
    },);
    if (afterTokenWhitespace === tokenEnd)
      break;

    /**
     * Candidate leading token inspected as assignment or wrapper.
     */
    const token = command.slice(
      cursor,
      tokenEnd,
    );
    if ((!token.startsWith('-',)) && token.includes('=',)) {
      cursor = afterTokenWhitespace;
      continue;
    }

    if (!COMMAND_NOISE_WRAPPERS.has(token,))
      break;

    /**
     * End offset of wrapper argument token.
     */
    const argumentEnd = findTokenEnd({
      command,
      at: afterTokenWhitespace,
    },);
    if (argumentEnd === afterTokenWhitespace)
      break;

    /**
     * Offset after whitespace following wrapper argument.
     */
    const afterArgumentWhitespace = skipShellWhitespace({
      command,
      at: argumentEnd,
    },);
    if (afterArgumentWhitespace === argumentEnd)
      break;
    cursor = afterArgumentWhitespace;
  }
  return cursor;
}

/**
 * Strips leading shell command noise from display text.
 *
 * @param command - because Bash-like tool titles should emphasize meaningful work
 *
 * @returns command suffix after every recognized prefix is stripped
 *
 * @example
 * ```ts
 * stripCommandNoise('NODE_ENV=prod timeout 5 npm test');
 * // 'npm test'
 * ```
 */
function stripCommandNoise(command: string,): string {
  /**
   * Offset where meaningful command text begins.
   */
  const cursor = findCommandNoiseEnd(command,);
  if (cursor >= command.length)
    return '';
  return command.slice(cursor,);
}

/**
 * Shortens shell command display text for terminal titles.
 *
 * @param command - because host-specific Bash tools pass complete command lines
 *
 * @returns command after leading noise prefixes are stripped
 *
 * @example
 * ```ts
 * shortCommand('timeout 10 npm test');
 * // 'npm test'
 * ```
 */
function shortCommand(command: string,): string {
  return stripCommandNoise(command,);
}

//endregion Shell prefix model

export {
  shortCommand,
  stripCommandNoise,
};
