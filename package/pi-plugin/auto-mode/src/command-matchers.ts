/**
 * User-configured bash command matcher helpers.
 *
 * Project config may name complete commands such as `terraform` or command
 * prefixes such as `docker compose`. This module owns matching those config
 * entries against parsed bash command segments.
 *
 * @module
 */

import type { BashAnalysis, } from './types.ts';

//region Public types

/**
 * A command matcher: either command name or command prefix.
 */
type CommandMatcher = string | readonly string[];

//endregion Public types

//region Public API

/**
 * Check if any command matches user-configured matchers.
 *
 * @param analysis - parsed bash command analysis
 *
 * @param matchers - configured command names or prefixes
 *
 * @returns `true` when any parsed command matches configured matcher
 *
 * @example
 * ```typescript
 * matchUserCommands({ analysis, matchers: ['terraform'] });
 * matchUserCommands({ analysis, matchers: [['docker', 'compose']] });
 * ```
 */
function matchUserCommands(
  {
    analysis,
    matchers,
  }: {
    readonly analysis: BashAnalysis;
    readonly matchers: readonly CommandMatcher[];
  },
): boolean {
  for (const cmd of analysis.commands) {
    for (const matcher of matchers) {
      if ((typeof matcher) === 'string') {
        if (cmd.name
          === matcher)
          return true;
      }
      else {
        if (cmd.name
          !== matcher[0])
          continue;
        /**
         * Argument tokens that must appear after command name for matcher to fire.
         */
        const prefix = matcher.slice(1,);
        if (prefix.every(
          function argMatches(
            sub,
            index,
          ) {
            return cmd.args[index]
              === sub;
          },
        )) {
          return true;
        }
      }
    }
  }
  return false;
}

//endregion Public API

export { matchUserCommands, };
export type { CommandMatcher, };
