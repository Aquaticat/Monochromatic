import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

//region Candidate selection
// The last deterministic gate: the unchanged translation always competes,
// and a repaired candidate wins only by the settled lexicographic order
// (integrity, high-severity resolution, no regressions, preservation).
// When nothing demonstrably beats the original, the original returns with
// its unresolved issues; a repair pipeline that cannot prove improvement
// must not ship its edit.

/**
 * Everything measured about one candidate translation.
 * Measurements come from deterministic checks and the semantic resolution
 * stage; selection itself never calls a model.
 *
 * @example
 * ```ts
 * const measurements: CandidateMeasurements = {
 *   integrityOk: true,
 *   resolvedHighSeverity: 2,
 *   resolvedTotal: 3,
 *   regressionCount: 0,
 *   changedCharCount: 41,
 * };
 * ```
 */
export type CandidateMeasurements = {
  /**
   * Whether the candidate still parses and keeps document conventions
   * (footnote graph resolvable, front matter intact).
   */
  readonly integrityOk: boolean;

  /**
   * Accepted critical and major issues the resolution stage confirmed fixed.
   */
  readonly resolvedHighSeverity: number;

  /**
   * Accepted issues of any severity confirmed fixed.
   */
  readonly resolvedTotal: number;

  /**
   * New defects the no-regression check found in changed regions.
   */
  readonly regressionCount: number;

  /**
   * Characters differing from the unchanged translation;
   * smaller is more conservative.
   */
  readonly changedCharCount: number;
};

/**
 * One competing translation with its measurements.
 *
 * @example
 * ```ts
 * const candidate: RepairCandidate = {
 *   candidateId: 'candidate/unchanged',
 *   text: targetText,
 *   measurements,
 * };
 * ```
 */
export type RepairCandidate = {
  /**
   * Stable handle for reporting which candidate won.
   */
  readonly candidateId: string;

  /**
   * Candidate translation text.
   */
  readonly text: string;

  /**
   * Measurements selection ranks by.
   */
  readonly measurements: CandidateMeasurements;
};

/**
 * Identity of the always-competing unchanged candidate;
 * selection prefers it on perfect ties, because shipping an edit that
 * proves nothing is worse than shipping nothing.
 */
export const UNCHANGED_CANDIDATE_ID = 'candidate/unchanged';

/**
 * Measurements of the unchanged translation:
 * intact by definition, resolving nothing, regressing nothing,
 * changing nothing.
 */
export const UNCHANGED_MEASUREMENTS: CandidateMeasurements = {
  integrityOk: true,
  resolvedHighSeverity: 0,
  resolvedTotal: 0,
  regressionCount: 0,
  changedCharCount: 0,
};

/**
 * Compares two candidates under the settled lexicographic order.
 * Negative means left ranks better.
 * Order: integrity, high-severity resolution (more is better), regressions
 * (fewer is better), total resolution (more is better), preservation
 * (fewer changed characters is better); the unchanged candidate wins any
 * remaining tie, and candidate id breaks ties between equals otherwise so
 * selection stays deterministic.
 *
 * @param left - one candidate
 *
 * @param right - other candidate
 *
 * @returns Comparator value ranking better candidates first
 *
 * @example
 * ```ts
 * candidates.toSorted(function rank(left, right,) {
 *   return compareCandidates({ left, right, },);
 * },);
 * ```
 */
export function compareCandidates(
  {
    left,
    right,
  }: {
    readonly left: RepairCandidate;
    readonly right: RepairCandidate;
  },
): number {
  /**
   * Measurement shorthands.
   */
  const l = left.measurements;

  /**
   * Right-side shorthand.
   */
  const r = right.measurements;
  if (l.integrityOk !== r.integrityOk)
    return l.integrityOk ? -1 : 1;
  if (l.resolvedHighSeverity !== r.resolvedHighSeverity)
    return r.resolvedHighSeverity - l.resolvedHighSeverity;
  if (l.regressionCount !== r.regressionCount)
    return l.regressionCount - r.regressionCount;
  if (l.resolvedTotal !== r.resolvedTotal)
    return r.resolvedTotal - l.resolvedTotal;
  if (l.changedCharCount !== r.changedCharCount)
    return l.changedCharCount - r.changedCharCount;
  if ((left.candidateId === UNCHANGED_CANDIDATE_ID) !== (right.candidateId === UNCHANGED_CANDIDATE_ID))
    return left.candidateId === UNCHANGED_CANDIDATE_ID ? -1 : 1;
  return left.candidateId
    .localeCompare(right.candidateId,);
}

/**
 * Selection result: the winner plus the full ranking for reporting.
 *
 * @example
 * ```ts
 * const { winner, ranking, } = selectRepairCandidate({ candidates, },);
 * ```
 */
export type CandidateSelection = {
  /**
   * Best candidate under the lexicographic order.
   */
  readonly winner: RepairCandidate;

  /**
   * Every candidate best-first, for the output contract's transparency.
   */
  readonly ranking: readonly RepairCandidate[];
};

/**
 * Picks the winning candidate.
 * Callers must include the unchanged translation among the candidates;
 * selection throws when it is absent because a slate without the original
 * cannot honor the always-competes guarantee.
 *
 * @param candidates - competing candidates including the unchanged one
 *
 * @returns Winner plus full ranking
 *
 * @throws {@link Error} when the unchanged candidate is missing or the slate is empty
 *
 * @example
 * ```ts
 * const { winner, } = selectRepairCandidate({ candidates: [unchanged, repaired,], },);
 * ```
 */
export function selectRepairCandidate(
  { candidates, }: { readonly candidates: readonly RepairCandidate[]; },
): CandidateSelection {
  if (!candidates.some(function isUnchanged(candidate,) {
    return candidate.candidateId === UNCHANGED_CANDIDATE_ID;
  },))
  {
    throw new Error(
      'candidate slate must include the unchanged translation; it always competes',
    );
  }

  /**
   * Candidates best-first under the lexicographic order.
   */
  const ranking = [...candidates,].toSorted(function rank(
    left,
    right,
  ) {
    return compareCandidates({
      left,
      right,
    },);
  },);

  return {
    winner: nonNullishOrThrow(ranking[0],),
    ranking,
  };
}

//endregion Candidate selection
