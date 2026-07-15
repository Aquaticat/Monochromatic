import type {
  StopInput,
  StopOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types/ts';
import type { ReadonlyDeep, } from 'type-fest';

import {
  findCategoricalDismissal,
  findTrailingQuestion,
  findUncertainty,
  NO_MATCH,
  stripNonProseRegions,
} from './uncertainty.ts';

/**
 * Output returned by the stop-reminders handler.
 *
 * Either a typed {@link StopOutput} carrying a block decision and concatenated
 * reasons, or the empty pass-through `{}`. Every {@link StopOutput} field is
 * optional, so `{}` is itself a valid {@link StopOutput}; no separate empty type
 * is needed.
 */
type StopRemindersOutput = StopOutput;

/**
 * Detects uncertain language and trailing user-directed questions in Claude's
 * final response, returning a `block` decision when either is present so Claude
 * is reminded to investigate or to use `AskUserQuestion` instead.
 *
 * Decision tree:
 *
 * 1. **Loop guard**: when `stop_hook_active` is `true`, returns `{}` to allow
 *    the stop unconditionally; re-blocking would create an endless cycle.
 * 2. **Prose extraction**: {@link stripNonProseRegions} strips code blocks,
 *    inline code, blockquotes, and quoted strings from `last_assistant_message`
 *    before scanning.
 * 3. **Uncertainty scan**: {@link findUncertainty} matches against hedging
 *    phrases (probably, maybe, I think, etc.); a hit contributes a reminder
 *    to gather evidence.
 * 4. **Trailing-question scan**: {@link findTrailingQuestion} looks for
 *    sentences ending in `?` in the last 500 characters; rhetorical/conditional
 *    prefixes are excluded.
 * 5. **Result**: if any reasons accumulated, returns
 *    `\{ decision: 'block', reason: [reasons joined by space] \}`;
 *    otherwise `\{\}`.
 *
 * @param event - parsed {@link StopInput} event from Claude Code
 *
 * @returns blocking output when reminders apply, otherwise `{}`
 *
 * @example
 * ```ts
 * stopRemindersHandler({ stop_hook_active: false, last_assistant_message: 'Done?' });
 * ```
 */
function stopRemindersHandler(event: ReadonlyDeep<StopInput>,): StopRemindersOutput {
  if (event.stop_hook_active)
    return {};

  /**
   * Final assistant message with code blocks, inline code, and quotes stripped before scanning.
   */
  const prose = stripNonProseRegions(event.last_assistant_message
    ?? '',);
  /**
   * First hedging-phrase hit, or `NO_MATCH`; populates the uncertainty reminder when matched.
   */
  const match = findUncertainty(prose,);
  /**
   * First uncited categorical-dismissal hit, or `NO_MATCH`; populates the dismissal reminder when matched.
   */
  const dismissal = findCategoricalDismissal(prose,);
  /**
   * Trailing user-directed question hit, or `NO_MATCH`; populates the AskUserQuestion reminder when matched.
   */
  const question = findTrailingQuestion(prose,);

  /**
   * Reminder lines accumulated across the three detectors; joined into the final block reason.
   */
  const reasons: string[] = [];

  if (match !== NO_MATCH) {
    reasons.push(
      `Your response contains uncertain language ("${match.phrase}").`,
      'Search for evidence, read the relevant code, or check documentation.',
      'Always research thoroughly before responding.',
      'If you have already investigated and the uncertainty is genuinely warranted,',
      'say so explicitly and continue with your response.',
      'This may be a false positive; use your judgement.',
    );
  }

  if (dismissal !== NO_MATCH) {
    reasons.push(
      `Your response contains an uncited categorical dismissal ("${dismissal.phrase}").`,
      'Categorical dismissals are one rg/find/config-read/AGENTS.md-grep away from being verified.',
      'Cite the search result inline on the same line as the dismissal:',
      'a file path with an extension, a path:line reference, or the literal "AGENTS.md".',
      'If the dismissal was wrong, fold the now-relevant option back into the analysis.',
      'This may be a false positive; use your judgement.',
    );
  }

  if (question !== NO_MATCH) {
    reasons.push(
      `Your response ends with a question to the user ("${question.sentence}").`,
      'Use the AskUserQuestion tool to ask the user instead of ending your response with a question.',
      'The AskUserQuestion tool ensures the user sees and can respond to your question directly.',
      'Rephrase your question as an AskUserQuestion tool call and continue.',
    );
  }

  if (reasons.length
    > 0) {
    return {
      decision: 'block',
      reason: reasons.join(' ',),
    };
  }

  return {};
}

/**
 * Parses raw stdin as a {@link StopInput}.
 *
 * Input is trusted; it comes from Claude Code's hook dispatch system.
 *
 * @param raw - JSON payload from Claude Code stdin
 *
 * @returns parsed Stop event
 *
 * @example
 * ```ts
 * const event = stopRemindersParser(await text(process.stdin));
 * ```
 */
function stopRemindersParser(raw: string,): StopInput {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted JSON contract from Claude Code hook system
  return JSON.parse(raw,) as StopInput;
}

/**
 * Serializes the stop-reminders output for stdout.
 *
 * No trailing newline; matches Claude Code's wire convention.
 *
 * @param output - {@link StopRemindersOutput} handler result to serialize
 *
 * @returns JSON string for stdout
 *
 * @mutates output - `JSON.stringify` may invoke `toJSON`, getters, or proxy traps.
 *
 * @example
 * ```ts
 * process.stdout.write(stopRemindersWriter({}));
 * ```
 */
function stopRemindersWriter(output: StopRemindersOutput,): string {
  return JSON.stringify(output,);
}

export type { StopRemindersOutput, };

export {
  stopRemindersHandler,
  stopRemindersParser,
  stopRemindersWriter,
};
