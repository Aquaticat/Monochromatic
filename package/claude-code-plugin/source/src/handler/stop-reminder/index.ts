import type {
  StopInput,
  StopOutput,
} from '@monochromatic-dev/claude-code-plugin-hook-type/ts';
import type { ReadonlyDeep, } from 'type-fest';

import {
  autoContinueActive,
  autoContinueReason,
} from './auto-continue.ts';
import {
  continuationDepth,
  MAX_DEPTH_ENV,
  maxContinuationDepth,
  readTranscriptTail,
} from './continuation-depth.ts';
import {
  hasRunningBackgroundTask,
  workedSinceLastForcedContinuation,
} from './continuation-progress.ts';
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
 * 1. **Response-quality gate**: the hedging, dismissal, and trailing-question
 *    detectors run only when `stop_hook_active` is `false`. They ask whether
 *    this response is defective, so re-running them inside a blocked chain
 *    would re-block on text the agent was already told about. Claude Code sets
 *    `stop_hook_active` on every stop of a blocked chain and never clears it.
 * 2. **Prose extraction**: {@link stripNonProseRegions} strips code blocks,
 *    inline code, blockquotes, and quoted strings from `last_assistant_message`
 *    before scanning.
 * 3. **Uncertainty scan**: {@link findUncertainty} matches against hedging
 *    phrases (probably, maybe, I think, etc.); a hit contributes a reminder
 *    to gather evidence.
 * 4. **Trailing-question scan**: {@link findTrailingQuestion} looks for
 *    sentences ending in `?` in the last 500 characters; rhetorical/conditional
 *    prefixes are excluded.
 * 5. **Forced continuation**: unless a trailing question matched, and unless
 *    `forcedContinuationAllowed` is false, {@link autoContinueReason} is
 *    appended on every stop including stops inside a blocked chain. This is the
 *    one detector that re-arms, and it reads none of the response text.
 *    Claude Code does not reliably end the resulting chain, so the caller is
 *    responsible for bounding it; see `continuation-depth.ts`.
 * 6. **Result**: if any reasons accumulated, returns
 *    `\{ decision: 'block', reason: [reasons joined by space] \}`;
 *    otherwise `\{\}`.
 *
 * Pure by construction: every ambient input arrives as a parameter, so each
 * branch is reachable in a test without touching process state. An earlier
 * revision read the kill switch inside this function, which made the disabled
 * branch testable only by mutating `process.env` and left those tests racing
 * once the handler became asynchronous.
 *
 * @param event - parsed {@link StopInput} event from Claude Code
 *
 * @param forcedContinuationAllowed - whether to append the continuation reason
 *
 * @returns blocking output when reminders apply, otherwise `{}`
 *
 * @example
 * ```ts
 * stopRemindersDecision({ event, forcedContinuationAllowed: true });
 * ```
 */
function stopRemindersDecision(
  {
    event,
    forcedContinuationAllowed,
  }: {
    readonly event: ReadonlyDeep<StopInput>;
    readonly forcedContinuationAllowed: boolean;
  },
): StopRemindersOutput {
  /**
   * Whether the response-quality detectors apply to this stop.
   *
   * False for every stop after the first in a blocked chain, so a forced
   * continuation is never re-blocked for wording the agent already answered for.
   */
  const responseQualityApplies = !event.stop_hook_active;

  /**
   * Final assistant message with code blocks, inline code, and quotes stripped before scanning.
   */
  const prose = stripNonProseRegions(event.last_assistant_message
    ?? '',);
  /**
   * First hedging-phrase hit, or `NO_MATCH`; populates the uncertainty reminder when matched.
   */
  const match = responseQualityApplies
    ? findUncertainty(prose,)
    : NO_MATCH;
  /**
   * First uncited categorical-dismissal hit, or `NO_MATCH`; populates the dismissal reminder when matched.
   */
  const dismissal = responseQualityApplies
    ? findCategoricalDismissal(prose,)
    : NO_MATCH;
  /**
   * Trailing user-directed question hit, or `NO_MATCH`; populates the AskUserQuestion reminder when matched.
   */
  const question = responseQualityApplies
    ? findTrailingQuestion(prose,)
    : NO_MATCH;

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

  // A trailing question takes precedence over forced continuation: instructing the
  // agent to resume work and to route its question through AskUserQuestion in the
  // same reason would be contradictory, and the question reason already refuses the stop.
  if ((question === NO_MATCH)
    && forcedContinuationAllowed) {
    reasons.push(...autoContinueReason(),);
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
 * Reads ambient state, then delegates to {@link stopRemindersDecision}.
 *
 * All environment and filesystem access lives here so the policy stays pure and
 * testable. Depth is only computed when forced continuation is enabled, since
 * the transcript read is pointless otherwise.
 *
 * @param event - parsed {@link StopInput} event from Claude Code
 *
 * @returns blocking output when reminders apply, otherwise `{}`
 *
 * @example
 * ```ts
 * await stopRemindersHandler(event);
 * ```
 */
async function stopRemindersHandler(event: ReadonlyDeep<StopInput>,): Promise<StopRemindersOutput> {
  /**
   * Whether the kill switch leaves forced continuation enabled.
   */
  const enabled = autoContinueActive();
  /**
   * Forced continuations already issued for this human turn.
   *
   * Claude Code does not reliably end a blocked chain, so this bound is the
   * only termination guarantee; see `continuation-depth.ts` for the measurement.
   */
  const transcript = enabled
    ? await readTranscriptTail(event.transcript_path,)
    : [];
  /**
   * Forced continuations already issued for this human turn.
   */
  const depth = continuationDepth(transcript,);
  /**
   * Whether the previous forced continuation produced any tool call.
   *
   * Releases a session that is blocked on something outside the agent control,
   * where pushing again yields another restatement rather than work.
   */
  const worked = workedSinceLastForcedContinuation(transcript,);
  /**
   * Whether a background task is still running.
   *
   * The session is waiting on something another turn cannot advance, so pushing
   * buys a restatement of the wait rather than work.
   */
  const waiting = hasRunningBackgroundTask(event.background_tasks,);

  return stopRemindersDecision({
    event,
    forcedContinuationAllowed: enabled
      && (depth < maxContinuationDepth(process.env[MAX_DEPTH_ENV] ?? '',))
      && worked
      && (!waiting),
  },);
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
  stopRemindersDecision,
  stopRemindersHandler,
  stopRemindersParser,
  stopRemindersWriter,
};
