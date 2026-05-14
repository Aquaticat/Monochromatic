import type {
  StopInput,
  StopOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';
import {
  findCategoricalDismissal,
  findTrailingQuestion,
  findUncertainty,
  stripNonProseRegions,
} from './uncertainty.ts';

/**
 * Output union returned by the stop-reminders handler.
 *
 * Either an empty pass-through (`{}`) or a typed `StopOutput` carrying a
 * block decision and concatenated reasons.
 */
type StopRemindersOutput = StopOutput | Record<string, never>;

/**
 * Detects uncertain language and trailing user-directed questions in Claude's
 * final response, returning a `block` decision when either is present so Claude
 * is reminded to investigate or to use `AskUserQuestion` instead.
 *
 * Decision tree:
 *
 * 1. **Loop guard** -- when `stop_hook_active` is `true`, returns `{}` to allow
 *    the stop unconditionally; re-blocking would create an endless cycle.
 * 2. **Prose extraction** -- strips code blocks, inline code, blockquotes, and
 *    quoted strings from `last_assistant_message` before scanning.
 * 3. **Uncertainty scan** -- matches against hedging phrases (probably, maybe,
 *    I think, etc.); a hit contributes a reminder to gather evidence.
 * 4. **Trailing-question scan** -- looks for sentences ending in `?` in the
 *    last 500 characters; rhetorical/conditional prefixes are excluded.
 * 5. **Result** -- if any reasons accumulated, returns `{ decision: 'block',
 *    reason: <reasons joined by space> }`; otherwise `{}`.
 *
 * @param event - parsed Stop event from Claude Code
 *
 * @returns blocking output when reminders apply, otherwise `{}`
 */
function stopRemindersHandler(event: StopInput,): StopRemindersOutput {
  if (event.stop_hook_active)
    return {};

  const prose = stripNonProseRegions(event.last_assistant_message ?? '',);
  const match = findUncertainty(prose,);
  const dismissal = findCategoricalDismissal(prose,);
  const question = findTrailingQuestion(prose,);

  const reasons: string[] = [];

  if (match !== undefined) {
    reasons.push(
      `Your response contains uncertain language ("${match.phrase}").`,
      'Search for evidence, read the relevant code, or check documentation.',
      'Always research thoroughly before responding.',
      'If you have already investigated and the uncertainty is genuinely warranted,',
      'say so explicitly and continue with your response.',
      'This may be a false positive; use your judgement.',
    );
  }

  if (dismissal !== undefined) {
    reasons.push(
      `Your response contains an uncited categorical dismissal ("${dismissal.phrase}").`,
      'Categorical dismissals are one rg/find/config-read/AGENTS.md-grep away from being verified.',
      'Cite the search result inline on the same line as the dismissal:',
      'a file path with an extension, a path:line reference, or the literal "AGENTS.md".',
      'If the dismissal was wrong, fold the now-relevant option back into the analysis.',
      'This may be a false positive; use your judgement.',
    );
  }

  if (question !== undefined) {
    reasons.push(
      `Your response ends with a question to the user ("${question.sentence}").`,
      'Use the AskUserQuestion tool to ask the user instead of ending your response with a question.',
      'The AskUserQuestion tool ensures the user sees and can respond to your question directly.',
      'Rephrase your question as an AskUserQuestion tool call and continue.',
    );
  }

  if (reasons.length > 0) {
    return {
      decision: 'block',
      reason: reasons.join(' ',),
    };
  }

  return {};
}

/**
 * Parses raw stdin as a `StopInput`.
 *
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 */
function stopRemindersParser(raw: string,): StopInput {
  /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
  return JSON.parse(raw,) as StopInput;
}

/**
 * Serializes the stop-reminders output for stdout.
 *
 * No trailing newline -- matches Claude Code's wire convention.
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
