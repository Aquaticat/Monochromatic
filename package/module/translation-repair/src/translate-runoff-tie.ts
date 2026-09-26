import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import {
  type Candidate,
  type CandidateWeight,
  describeProducer,
  type SelectionOutcome,
} from './candidate-select-model.ts';
import {
  type TranslateAbsenceReason,
  TranslateAbsenceError,
} from './translate-absence.ts';
import type { TranslateCandidateValue, } from './translate-candidates.ts';
import type { TranslateStageResult, } from './translate-stage-result.ts';

//region Translate run-off tie
// CLASS ONE HUNDRED SEVENTY-FOUR (TianqiChen6669 slice 4, 2026-09-26): the
// archive's rendering failed the class one hundred seventy-two floor, so the
// consolidation slate ran with nothing to keep; two valid renderings, "bore
// the greatest pressure on her frailest body" and "with the frailest body",
// tied 1.5 to 1.5, the run-off over the two tied 1.5 to 1.5 again, and the
// entry stopped INCOMPLETE after 24 minutes. A run-off of two cannot narrow,
// so the class eighty-two loop had nothing left to ask.
//
// THE OWNER'S RULE IS "PREFER THE BEST VALID PROPOSAL, ELSE FAIL THE SLICE"
// (2026-09-04): the failure is for a slice with no valid proposal, and here
// every finalist is valid and the judges could not rank them, which is a
// failure to rank rather than a rejection (`candidate-select-model.ts`). So a
// challenge round tied across every candidate it asked about ships one by
// preference: the repair lane's text first, the owner's fallback where the
// archive cannot stand ("Not eligible; fall back to the repair text",
// 2026-09-24), since it is the minimal edit of the human translation; then
// the translate lane's text; then slate order. A tie among some of the
// candidates still narrows through the class eighty-two loop, a first round
// is still challenged, and a round with an incumbent keeps it as before.

/**
 How a run-off tie was broken, as the finding names it.
 */
export type TieBasis = 'repair lane' | 'translate lane' | 'slate order';

/**
 What a challenge round's tie comes to: one finalist by preference, or no
 tie across every candidate to break.

 @example
 ```ts
 const tie: RunoffTie<TranslateCandidateValue> = { kind: 'unbroken', };
 ```
 */
export type RunoffTie<ValueT,> =
  | {
    readonly kind: 'broken';

    /**
     One-based position of the chosen finalist, as the judges saw it.
     */
    readonly index: number;

    /**
     The chosen finalist.
     */
    readonly candidate: Candidate<ValueT>;

    /**
     Weight every tied finalist drew.
     */
    readonly weight: number;

    /**
     Which preference chose it.
     */
    readonly basis: TieBasis;
  }
  | {
    /**
     Fewer than two drew weight, or some candidate drew less than the
     leaders, which a further run-off narrows instead.
     */
    readonly kind: 'unbroken';
  };

/**
 One tied finalist with its preference.
 */
type RankedFinalist<ValueT,> = {
  readonly index: number;
  readonly candidate: Candidate<ValueT>;
  readonly rank: number;
  readonly basis: TieBasis;
};

/**
 Finding a broken run-off tie records, followed by its basis in parentheses.
 */
export const RUNOFF_TIE_BROKEN_FINDING = 'translate-runoff-tie-broken';

/**
 Preference of a finalist: the repair lane's text first, the translate
 lane's next, a writer's proposal last.

 @param candidate - finalist the judges tied over

 @returns Rank, lower first, and the basis it names

 @example
 ```ts
 preferenceOf({ candidate, },); // { rank: 0, basis: 'repair lane' }
 ```
 */
function preferenceOf<ValueT,>(
  { candidate, }: { readonly candidate: Candidate<ValueT>; },
): {
  readonly rank: number;
  readonly basis: TieBasis;
} {
  /**
   Who wrote the finalist.
   */
  const { producer, } = candidate;
  if (producer.kind !== 'lane') {
    return {
      rank: 2,
      basis: 'slate order',
    };
  }
  return (producer.lane === 'repair')
    ? {
      rank: 0,
      basis: 'repair lane',
    }
    : {
      rank: 1,
      basis: 'translate lane',
    };
}

/**
 The finalist a challenge round tied across every candidate ships, by
 preference.

 @param candidates - candidates in the order the judges saw them

 @param perCandidate - what each position drew

 @returns The preferred finalist, or `unbroken` where fewer than two drew
 weight or some candidate drew less than the leaders

 @example
 ```ts
 const tie = breakRunoffTie({ candidates: rotated, perCandidate: outcome.perCandidate, },);
 ```
 */
export function breakRunoffTie<ValueT,>(
  {
    candidates,
    perCandidate,
  }: {
    readonly candidates: readonly Candidate<ValueT>[];
    readonly perCandidate: readonly CandidateWeight[];
  },
): RunoffTie<ValueT> {
  /**
   Highest weight any candidate drew.
   */
  const top = Math.max(
    0,
    ...perCandidate.map(function weightOf(drawn,): number {
      return drawn.weight;
    },),
  );

  /**
   Candidates at that weight.
   */
  const tied = perCandidate.filter(function atTop(drawn,): boolean {
    return (top > 0) && (drawn.weight === top);
  },);
  if ((tied.length < 2) || (tied.length !== candidates.length))
    return { kind: 'unbroken', };

  /**
   Tied finalists with their preference, best first, slate order breaking
   equal preference.
   */
  const [chosen,] = tied
    .flatMap(function withCandidate(drawn,): readonly RankedFinalist<ValueT>[] {
      /**
       Finalist at this one-based position.
       */
      const candidate = candidates[drawn.index - 1];
      return (candidate === undefined)
        ? []
        : [
          {
            index: drawn.index,
            candidate,
            ...preferenceOf({ candidate, },),
          },
        ];
    },)
    .toSorted(function byPreference(
      left: RankedFinalist<ValueT>,
      right: RankedFinalist<ValueT>,
    ): number {
      return (left.rank === right.rank) ? left.index - right.index : left.rank - right.rank;
    },);
  if (chosen === undefined)
    return { kind: 'unbroken', };
  return {
    kind: 'broken',
    index: chosen.index,
    candidate: chosen.candidate,
    weight: top,
    basis: chosen.basis,
  };
}

/**
 What a declined round ships where the slice has no incumbent: the preferred
 finalist where a challenge round tied across every candidate, else the
 absence error the retry reads.

 @param challenged - whether this round challenges an earlier decline

 @param outcome - the declined round

 @param rotated - candidates in the order the judges saw them

 @param keepIncumbent - the stage's record shape, whose slate and counts the
 shipped finalist keeps

 @param declineFindings - findings the decline reports

 @param declined - the decline in the stage's vocabulary

 @param finalists - candidates a partial tie backed, for the next run-off

 @param l - logger of the judging stage

 @returns The shipped finalist's record

 @throws {@link TranslateAbsenceError} when no tie across every candidate
 was broken

 @example
 ```ts
 return settleAbsentDecline({ challenged: true, outcome, rotated, keepIncumbent, declineFindings, declined, l, },);
 ```
 */
export function settleAbsentDecline(
  {
    challenged,
    outcome,
    rotated,
    keepIncumbent,
    declineFindings,
    declined,
    finalists,
    l,
  }: {
    readonly challenged: boolean;
    readonly outcome: Extract<SelectionOutcome<TranslateCandidateValue>, { readonly kind: 'declined'; }>;
    readonly rotated: readonly Candidate<TranslateCandidateValue>[];
    readonly keepIncumbent: Omit<TranslateStageResult, 'decision' | 'findings'>;
    readonly declineFindings: readonly string[];
    readonly declined: TranslateAbsenceReason;
    readonly finalists?: readonly Candidate<TranslateCandidateValue>[];
    readonly l: Logger;
  },
): TranslateStageResult {
  /**
   The tie this round comes to, read only on a challenge round's indecision.
   */
  const tie: RunoffTie<TranslateCandidateValue> = (challenged && (outcome.disposition === 'indecision'))
    ? breakRunoffTie({
      candidates: rotated,
      perCandidate: outcome.perCandidate,
    },)
    : { kind: 'unbroken', };
  if (tie.kind === 'unbroken') {
    throw new TranslateAbsenceError({
      reason: declined,
      findings: declineFindings,
      // Conditional spread keeps the field absent where the whole slate stands.
      ...((finalists === undefined) ? {} : { finalists, }),
    },);
  }

  /**
   The shipped finalist's value and author.
   */
  const {
    value,
    producer,
  } = tie.candidate;
  l.info(
    `translate stage: challenge round tied at weight ${String(tie.weight,)} across all ${String(rotated.length,)} `
      + `valid candidates with nothing to keep; shipping candidate ${String(tie.index,)} from `
      + `${describeProducer(producer,)} by ${tie.basis}`,
  );
  return {
    ...keepIncumbent,
    text: value.text,
    origin: value.origin,
    producer,
    decision: 'judged',
    voteWeight: tie.weight,
    tally: outcome.tally,
    ballots: outcome.ballots,
    findings: [
      ...declineFindings,
      `${RUNOFF_TIE_BROKEN_FINDING} (${tie.basis})`,
    ],
    selectedIndex: tie.index,
    shippedIndex: tie.index,
    perCandidate: outcome.perCandidate,
  };
}

//endregion Translate run-off tie
