import type {
  Candidate,
  CandidateWeight,
  SelectionDisposition,
} from './candidate-select-model.ts';

//region Translate run-off
// MEASURED ON XINGZ602 (2026-09-17, attempt 1): slice 14's archive text
// failed the deterministic floor, so the stage ran it with nothing to fall
// back on; five candidates went to the judges, three ballots were heard and
// they named three different candidates, at weight one each against a
// minimum of two. The challenge round put the SAME five candidates to the
// same panel and it split the same way, so the slate settled as
// `no-candidate-backed`, the entry stopped ERROR after two hours and
// thirty-eight minutes, and the next attempt re-bought the translate lane.
//
// A TIE IS A FAILURE TO RANK, NOT A REJECTION (`candidate-select-model.ts`),
// and the candidates nobody named have already lost the ranking. The
// challenge round is therefore a run-off over the candidates that drew a
// ballot, when that is fewer than the whole slate: the judges are asked a
// narrower question rather than the identical one. A second tie across every
// finalist ships one of them by preference where nothing stands to keep
// (class one hundred seventy-four, `translate-runoff-tie.ts`).
//
// NARROWED TO THE LEADERS ON XINGZ613 (2026-09-19, class sixty-three): slice
// 84's standing was ineligible, four valid proposals went to a bench at
// quorum, and the ballots split 1.5, 1 and 1 against the absolute minimum of
// 2. Every candidate but one had drawn a ballot, so the run-off over the
// backed candidates was the same three-way question, and it split the same
// way; the entry stopped over a heading whose every rendering was valid.
// The candidates below the leaders have lost the ranking as surely as the
// unnamed ones, so the run-off offers the leaders alone: the tied leaders
// on a tie, the leader and its runner-up on a plurality under the minimum.
// Two candidates is a question a bench of whole and half ballots settles
// unless it abstains, which is a decline this should keep.

/**
 Whether a declined round's challenge is a run-off, and over which candidates.

 @example
 ```ts
 const runoff: Runoff<TranslateCandidateValue> = { kind: 'whole-slate', because: 'rejection', };
 ```
 */
export type Runoff<ValueT,> =
  | {
    /**
     A tie backed some of the slate and not the rest.
     */
    readonly kind: 'narrowed';

    /**
     Candidates that drew a ballot, in slate order.
     */
    readonly finalists: readonly Candidate<ValueT>[];
  }
  | {
    /**
     The challenge round offers the whole slate again.
     */
    readonly kind: 'whole-slate';

    /**
     Why nothing was narrowed: the judges rejected rather than tied, fewer
     than two candidates drew a ballot, or every candidate is a leader.
     */
    readonly because:
      | 'rejection'
      | 'fewer-than-two-backed'
      | 'every-candidate-backed';
  };

/**
 Leaders of an undecided round, when that leaves some of the slate behind:
 the candidates tied at the top, or the leader and its runner-up.

 @param candidates - slate in the order the judges saw it

 @param perCandidate - what each candidate drew, by one-based index

 @param disposition - whether the judges tied or rejected

 @returns Finalists in slate order, or the whole slate with the reason

 @example
 ```ts
 const runoff = runoffFinalists({ candidates: rotated, perCandidate: outcome.perCandidate, disposition: outcome.disposition, },);
 ```
 */
export function runoffFinalists<ValueT,>(
  {
    candidates,
    perCandidate,
    disposition,
  }: {
    readonly candidates: readonly Candidate<ValueT>[];
    readonly perCandidate: readonly CandidateWeight[];
    readonly disposition: SelectionDisposition;
  },
): Runoff<ValueT> {
  if (disposition === 'rejection')
    return {
      kind: 'whole-slate',
      because: 'rejection',
    };

  /**
   Candidates some ballot named, highest standing first.
   */
  const ranked = perCandidate
    .filter(function drewWeight(drawn,): boolean {
      return drawn.weight > 0;
    },)
    .toSorted(function byStanding(
      left,
      right,
    ): number {
      // Heavier first, then more ballots, then the earlier slate position.
      if (left.weight !== right.weight)
        return right.weight - left.weight;
      if (left.ballots !== right.ballots)
        return right.ballots - left.ballots;
      return left.index - right.index;
    },);
  /**
   Highest draw, absent when fewer than two candidates drew anything.
   */
  const [leader,] = ranked;
  if ((leader === undefined) || (ranked.length < 2))
    return {
      kind: 'whole-slate',
      because: 'fewer-than-two-backed',
    };
  /**
   Candidates tied at the top.
   */
  const leaders = ranked.filter(function tiedAtTop(drawn,): boolean {
    return drawn.weight === leader.weight;
  },);
  /**
   Who the run-off is over: the tied leaders, or the leader and its
   runner-up.
   */
  const offered = (leaders.length >= 2)
    ? leaders
    : ranked.slice(
      0,
      2,
    );
  if (offered.length >= candidates.length)
    return {
      kind: 'whole-slate',
      because: 'every-candidate-backed',
    };
  /**
   One-based indices of the finalists.
   */
  const finalists = new Set(offered.map(function toIndex(drawn,): number {
    return drawn.index;
  },),);
  return {
    kind: 'narrowed',
    finalists: candidates.filter(function isFinalist(
      _candidate,
      position,
    ): boolean {
      return finalists.has(position + 1,);
    },),
  };
}

/**
 Finding written when the challenge round is a run-off, so a reader can tell
 a narrowed second ask from a repeated one.

 @param finalists - how many candidates the run-off offered

 @param offered - how many the first round offered

 @returns Finding in scorecard-stable wording

 @example
 ```ts
 const finding = runoffFinding({ finalists: 3, offered: 4, },);
 ```
 */
export function runoffFinding(
  {
    finalists,
    offered,
  }: {
    readonly finalists: number;
    readonly offered: number;
  },
): string {
  return `translate-runoff (finalists ${String(finalists,)} of ${String(offered,)})`;
}

//endregion Translate run-off
