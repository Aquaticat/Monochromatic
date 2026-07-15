/**
 * Shell command summaries for terminal titles.
 *
 * @module
 */

import { analyzeShellCommand, } from '@monochromatic-dev/agent-harness-shared-shell-command-analyzer/ts';
import {
  commandTokensFromInfo,
  formatCommandTokens,
} from './command-tokens.ts';
import { unwrapCommandTokens, } from './command-wrappers.ts';

//region Public command API

/**
 * Summarizes shell command text for terminal titles.
 *
 * Uses the shared shell analyzer for parsing,
 * unwraps known command wrappers,
 * and falls back to raw command text when parsing fails.
 *
 * @param command - because Bash-like tool payloads carry complete command lines
 *
 * @returns meaningful command suffix for title text
 *
 * @example
 * ```ts
 * terminalTitleCommand('env timeout 10 npm test');
 * // 'npm test'
 * ```
 */
function terminalTitleCommand(command: string,): string {
  /**
   * Analyzer result for command source.
   */
  const analysis = analyzeShellCommand(command,);
  if (!analysis.parsed)
    return command;
  /**
   * First command that can execute immediately.
   */
  const [firstCommand,] = analysis.executedCommands;
  if (firstCommand === undefined)
    return command;
  return formatCommandTokens(
    unwrapCommandTokens(commandTokensFromInfo(firstCommand,),),
  );
}

//endregion Public command API

export { terminalTitleCommand, };
