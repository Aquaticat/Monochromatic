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
// narrower question rather than the identical one, and a second tie is still
// a settled decline.

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
     than two candidates drew a ballot, or every candidate did.
     */
    readonly because:
      | 'rejection'
      | 'fewer-than-two-backed'
      | 'every-candidate-backed';
  };

/**
 Candidates that drew a ballot in a tied round, when that leaves some of the
 slate behind.

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
   One-based indices of the candidates some ballot named.
   */
  const backed = new Set(perCandidate
    .filter(function drewWeight(drawn,): boolean {
      return drawn.weight > 0;
    },)
    .map(function toIndex(drawn,): number {
      return drawn.index;
    },),);
  if (backed.size < 2)
    return {
      kind: 'whole-slate',
      because: 'fewer-than-two-backed',
    };
  if (backed.size >= candidates.length)
    return {
      kind: 'whole-slate',
      because: 'every-candidate-backed',
    };
  return {
    kind: 'narrowed',
    finalists: candidates.filter(function isBacked(
      _candidate,
      position,
    ): boolean {
      return backed.has(position + 1,);
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
