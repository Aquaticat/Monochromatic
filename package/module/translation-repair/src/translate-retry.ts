import { judgeTranslateSlate, } from './translate-judge.ts';
import {
  TranslateAbsenceError,
  type TranslateAbsenceReason,
} from './translate-absence.ts';
import type { TranslateStageResult, } from './translate-stage-result.ts';

//region Translate retry
// Asks a declining panel once more, against the SAME slate.
//
// WHY THE SAME SLATE AND NOT A FRESH ONE: producing is the expensive half, and
// re-producing would change what is being judged, so a second decline would say
// nothing about the first. Judging the same candidates twice asks one question,
// whether this panel backs any of THESE, and `#109` split the stage into produce
// and judge halves so it could be asked twice.
//
// WHY ONCE AND NOT UNTIL IT AGREES: a panel that declines twice on identical
// input is not going to be talked round by a third ask, and every further round
// is bought at full roster cost against an entry deadline. One retry separates
// the momentary decline from the settled one, which is all the record needs.
//
// A DECLINE LEAVES BY TWO DIFFERENT DOORS and both are handled here. With an
// incumbent the stage RETURNS, keeping the archive's wording; with none it
// THROWS, because keeping nothing would ship the empty string as though judges
// had chosen it. The retry has to cover both or it would silently apply to half
// the slices.
//
// BOTH ROUNDS' FINDINGS ARE KEPT IN FULL, with the retry marker between them so
// position says which round produced which. They are NOT deduplicated: two
// rounds that each lose the same model's voice lost two voices, and collapsing
// them would report one. Nothing tallies findings by prefix today, so the
// repetition costs only verbosity; a consumer that ever does tally them has to
// decide per finding whether it names an event or a state, and this comment is
// the warning that the question exists.

/**
 * Declines worth buying a second judging for.
 *
 * `no-candidate` is deliberately absent: it means nothing usable was ever
 * proposed, so a second judging would be handed the same empty slate and cost a
 * full panel to reach the same answer.
 */
const RETRIED_DECLINES: readonly TranslateAbsenceReason[] = [
  'declined-indecision',
  'declined-rejection',
];

/**
 * Reason recorded once a retry has been spent and the panel still backed
 * nothing.
 */
const SETTLED_DECLINE: TranslateAbsenceReason = 'no-candidate-backed';

/**
 * Finding written when a slate is judged a second time, so a reader can tell a
 * retried decline from a first one without counting rounds.
 */
const RETRY_FINDING = 'translate-declined-retried';

/**
 * What one judging round produced.
 *
 * NAMED because a decline leaves by two doors and both have to be carried
 * together to the point where the retry decides: an inline union at the call
 * site would have to be repeated at every place that reads it.
 *
 * @example
 * ```ts
 * const round: JudgeRound = { kind: 'returned', result, };
 * ```
 */
type JudgeRound = {
  /**
   * Panel answered, whether by deciding or by declining with an incumbent to
   * fall back on.
   */
  readonly kind: 'returned';

  /**
   * What it decided.
   */
  readonly result: TranslateStageResult;
} | {
  /**
   * Panel refused, because this slice has no incumbent and a decline there
   * would ship the empty string.
   */
  readonly kind: 'raised';

  /**
   * Refusal it raised.
   */
  readonly error: TranslateAbsenceError;
};

/**
 * Whether a reason is one a second judging might change.
 *
 * @param reason - why the first judging gave up
 *
 * @returns Whether to buy another round
 *
 * @example
 * ```ts
 * const worthRetrying = isRetriedDecline({ reason: 'declined-indecision', },);
 * ```
 */
function isRetriedDecline({ reason, }: { readonly reason: string; },): boolean {
  return RETRIED_DECLINES.some(function matches(retried,): boolean {
    return retried === reason;
  },);
}

/**
 * Judges one produced slate, asking a declining panel exactly once more.
 *
 * @param judging - everything {@link judgeTranslateSlate} needs, forwarded
 * unchanged so this cannot drift from the half it wraps
 *
 * @returns What the panel decided, from whichever round decided it
 *
 * @throws {@link TranslateAbsenceError} when a slice with no incumbent is
 * declined twice, carrying `no-candidate-backed` rather than either round's own
 * reason
 *
 * @example
 * ```ts
 * const decided = await judgeSlateWithRetry({ judging, },);
 * ```
 */
export async function judgeSlateWithRetry(
  { judging, }: { readonly judging: Parameters<typeof judgeTranslateSlate>[0]; },
): Promise<TranslateStageResult> {
  /**
   * Logger the caller already tagged, destructured rather than reached through
   * on every use.
   */
  const { l, } = judging;

  /**
   * What the panel said the first time, or the refusal it raised.
   */
  const first = await (async function askOnce(): Promise<JudgeRound> {
    try {
      return {
        kind: 'returned',
        result: await judgeTranslateSlate(judging,),
      };
    }
    catch (error) {
      // Only an absence is a decline this can act on. Anything else, an abort
      // or a transport fault, belongs to the caller unchanged.
      if (!(error instanceof TranslateAbsenceError))
        throw error;

      return {
        kind: 'raised',
        error,
      };
    }
  })();

  /**
   * What the first round reported, whichever door it left by.
   *
   * Read ONCE rather than per field, so the two shapes are reconciled in one
   * place and every later line reads the same record regardless of which door
   * this was.
   */
  const firstReport = (first.kind === 'raised')
    ? {
      reason: first.error
        .reason,
      findings: first.error
        .findings,
    }
    : {
      reason: first.result
        .decision,
      findings: first.result
        .findings,
    };
  if (!isRetriedDecline({ reason: firstReport.reason, },)) {
    if (first.kind === 'raised')
      throw first.error;

    return first.result;
  }

  l.info(`translate stage: ${firstReport.reason}; asking the same panel once more`,);

  /**
   * Findings the first round gathered, which the second must not lose.
   */
  const firstFindings = firstReport.findings;
  try {
    /**
     * What the same panel said about the same candidates, second time.
     */
    const second = await judgeTranslateSlate(judging,);

    // A SECOND DECLINE IS RESTAMPED, a second decision is kept as it stands.
    // Either way the first round's findings are carried, so the record shows
    // both asks rather than only the one that answered.
    return {
      ...second,
      ...(isRetriedDecline({ reason: second.decision, },)
        ? { decision: SETTLED_DECLINE, }
        : {}),
      findings: [
        ...firstFindings,
        RETRY_FINDING,
        ...second.findings,
      ],
    };
  }
  catch (error) {
    if (!(error instanceof TranslateAbsenceError))
      throw error;

    throw new TranslateAbsenceError({
      reason: isRetriedDecline({ reason: error.reason, },) ? SETTLED_DECLINE : error.reason,
      findings: [
        ...firstFindings,
        RETRY_FINDING,
        ...error.findings,
      ],
    },);
  }
}

//endregion Translate retry
