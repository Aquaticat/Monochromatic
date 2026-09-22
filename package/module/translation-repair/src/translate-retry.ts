import { judgeTranslateSlate, } from './translate-judge.ts';
import {
  TranslateAbsenceError,
  type TranslateAbsenceReason,
} from './translate-absence.ts';
import { runoffFinding, } from './translate-runoff.ts';
import type { TranslateStageResult, } from './translate-stage-result.ts';

//region Translate retry
// Challenges a declining panel once more against SAME slate.
//
// WHY SAME SLATE AND NOT FRESH ONE: producing is expensive half,
// and re-producing would change question.
// Second judging challenges prior decline under distinct responsibility rather
// than pretending identical prompt is independent evidence.
// `#109` split stage into produce and judge halves so this is expressible.
//
// EXCEPT A RUN-OFF AFTER A TIE WITH NOTHING TO FALL BACK ON (class
// fifty-three, `translate-runoff.ts`): a tie has already ranked the
// candidates nobody named below the rest, so the challenge round offers only
// the candidates that drew a ballot when that is fewer than the slate. The
// question is narrower, not a fresh slate.
//
// WHY ONCE AND NOT UNTIL IT AGREES: a panel that declines initial selection and
// distinct challenge has exhausted these responsibilities.
// Every further round costs full roster against entry deadline.
//
// EXCEPT WHILE A RUN-OFF KEEPS NARROWING (class eighty-two, XingZ621 slice
// 14, 2026-09-22): eight valid candidates over an ineligible standing split
// one ballot each four ways, the run-off over the four leaders split 1, 1
// and 0.5 with one seat declining, and the entry stopped after three hours
// though that tie had ranked two of the four below the rest. A tie that
// narrows the finalists is a new, narrower question, the same reason the
// first run-off exists, so the panel is asked again over the narrowed
// finalists while each round narrows further; a round that decides, or a
// tie that narrows nothing, ends it. Each round strictly shrinks the
// finalists, so the rounds are bounded by the slate's width.
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
 Declines worth buying a second judging for.
 
 `no-candidate` is deliberately absent: it means nothing usable was ever
 proposed, so a second judging would be handed the same empty slate and cost a
 full panel to reach the same answer.
 */
const RETRIED_DECLINES: readonly TranslateAbsenceReason[] = [
  'declined-indecision',
  'declined-rejection',
];

/**
 Reason recorded once a retry has been spent and the panel still backed
 nothing.
 */
const SETTLED_DECLINE: TranslateAbsenceReason = 'no-candidate-backed';

/**
 Finding written when a slate is judged a second time, so a reader can tell a
 retried decline from a first one without counting rounds.
 */
const RETRY_FINDING = 'translate-declined-retried';

/**
 What one judging round produced.
 
 NAMED because a decline leaves by two doors and both have to be carried
 together to the point where the retry decides: an inline union at the call
 site would have to be repeated at every place that reads it.
 
 @example
 ```ts
 const round: JudgeRound = { kind: 'returned', result, };
 ```
 */
type JudgeRound = {
  /**
   Panel answered, whether by deciding or by declining with an incumbent to
   fall back on.
   */
  readonly kind: 'returned';

  /**
   What it decided.
   */
  readonly result: TranslateStageResult;
} | {
  /**
   Panel refused, because this slice has no incumbent and a decline there
   would ship the empty string.
   */
  readonly kind: 'raised';

  /**
   Refusal it raised.
   */
  readonly error: TranslateAbsenceError;
};

/**
 Whether a reason is one a second judging might change.
 
 @param reason - why the first judging gave up
 
 @returns Whether to buy another round
 
 @example
 ```ts
 const worthRetrying = isRetriedDecline({ reason: 'declined-indecision', },);
 ```
 */
function isRetriedDecline({ reason, }: { readonly reason: string; },): boolean {
  return RETRIED_DECLINES.some(function matches(retried,): boolean {
    return retried === reason;
  },);
}

/**
 Asks the panel once, carrying a decline out by whichever door it leaves.

 @param judging - everything {@link judgeTranslateSlate} needs

 @returns Decision or the absence it raised

 @throws Anything but an absence, an abort or a transport fault, which
 belongs to the caller unchanged

 @example
 ```ts
 const round = await askJudges({ judging, },);
 ```
 */
async function askJudges(
  { judging, }: { readonly judging: Parameters<typeof judgeTranslateSlate>[0]; },
): Promise<JudgeRound> {
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
}

/**
 Judges one produced slate, asking a declining panel again while each
 run-off narrows the question, and once more otherwise.

 @param judging - everything {@link judgeTranslateSlate} needs, forwarded
 unchanged so this cannot drift from the half it wraps
 
 @returns What the panel decided, from whichever round decided it
 
 @throws {@link TranslateAbsenceError} when a slice with no incumbent is
 declined twice, carrying `no-candidate-backed` rather than either round's own
 reason
 
 @example
 ```ts
 const decided = await judgeSlateWithRetry({ judging, },);
 ```
 */
export async function judgeSlateWithRetry(
  { judging, }: { readonly judging: Parameters<typeof judgeTranslateSlate>[0]; },
): Promise<TranslateStageResult> {
  /**
   Logger the caller already tagged, destructured rather than reached through
   on every use.
   */
  const { l, } = judging;

  /**
   What the panel said the first time, or the refusal it raised.
   */
  const first = await askJudges({ judging, },);

  /**
   What the first round reported, whichever door it left by.
   
   Read ONCE rather than per field, so the two shapes are reconciled in one
   place and every later line reads the same record regardless of which door
   this was.
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

  l.info(`translate stage: ${firstReport.reason}; challenging same panel under distinct responsibility`,);

  /**
   Candidates the tied first round backed, when a run-off narrows the second.
   */
  const finalists = (first.kind === 'raised')
    ? first.error
      .finalists
    : undefined;

  /**
   Findings the first round gathered, which the second must not lose, with
   the run-off named after the retry marker when the second round is one.
   */
  const firstFindings = [
    ...firstReport.findings,
    RETRY_FINDING,
    ...((finalists === undefined)
      ? []
      : [
        runoffFinding({
          finalists: finalists.length,
          offered: judging.produced
            .candidates
            .length,
        },),
      ]),
  ];
  /**
   Slate the whole stage was offered, which a run-off narrows.
   */
  const slate = judging.produced
    .candidates;

  /**
   What the next challenge round asks over and what every round so far
   found, advanced together as each run-off narrows the question (class
   eighty-two). The whole slate stands where no tie narrowed it.
   */
  const cursor: {
    offered: typeof slate;
    findings: readonly string[];
  } = {
    offered: finalists ?? slate,
    findings: firstFindings,
  };

  /**
   Rounds the run-offs can take at most: each strictly shrinks the finalists
   and a narrowed run-off keeps at least two, so the slate's width bounds
   them; the cap is the proof, never reached in practice.
   */
  const roundCap = slate.length + 1;
  for (let round = 2; round <= roundCap; round += 1) {
    /**
     Candidates this round is over.
     */
    const { offered, } = cursor;

    /**
     How many this round is over.
     */
    const offeredCount = offered.length;

    /**
     Whether this round is a run-off over fewer candidates than the slate.
     */
    const narrowed = offeredCount < slate.length;

    /**
     What the same panel said this round, about the same candidates or
     about the finalists of a tie.
     */
    // oxlint-disable-next-line no-await-in-loop -- each round's question is the previous round's tie, so the rounds cannot run in parallel
    const again = await askJudges({
      judging: {
        ...judging,
        // Conditional spread keeps the whole slate where there is no run-off.
        ...(narrowed
          ? {
            produced: {
              ...judging.produced,
              candidates: offered,
            },
            // The ballot floor decides a run-off between valid finalists
            // (class seventy-three).
            runoff: true,
          }
          : {}),
        responsibility: 'decline-challenge',
      },
    },);

    // A DECLINE THAT RETURNS IS RESTAMPED, a decision is kept as it stands.
    // Either way every earlier round's findings are carried, so the record
    // shows each ask rather than only the one that answered.
    if (again.kind === 'returned') {
      /**
       What the panel returned.
       */
      const { result, } = again;
      return {
        ...result,
        ...(isRetriedDecline({ reason: result.decision, },)
          ? { decision: SETTLED_DECLINE, }
          : {}),
        findings: [
          ...cursor.findings,
          ...result.findings,
        ],
      };
    }

    /**
     Refusal this round raised.
     */
    const { error, } = again;
    if (!isRetriedDecline({ reason: error.reason, },)) {
      throw new TranslateAbsenceError({
        reason: error.reason,
        findings: [
          ...cursor.findings,
          ...error.findings,
        ],
      },);
    }

    /**
     Finalists a tie this round left, when fewer than it was offered.
     */
    const next = error.finalists;
    if ((next === undefined) || (next.length >= offeredCount)) {
      throw new TranslateAbsenceError({
        reason: SETTLED_DECLINE,
        findings: [
          ...cursor.findings,
          ...error.findings,
        ],
      },);
    }
    l.info(
      `translate stage: run-off tied again over ${String(offeredCount,)} finalists and narrowed to ${
        String(next.length,)
      }; asking the same panel over them`,
    );
    cursor.findings = [
      ...cursor.findings,
      ...error.findings,
      RETRY_FINDING,
      runoffFinding({
        finalists: next.length,
        offered: offeredCount,
      },),
    ];
    cursor.offered = next;
  }
  throw new Error(
    `translate stage: the run-off narrowed more times than the slate of ${String(slate.length,)} allows`,
  );
}

//endregion Translate retry
