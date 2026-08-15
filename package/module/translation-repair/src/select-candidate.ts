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
 *   regressedKnownIssues: 0,
 *   touchedRegionChars: 41,
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
   * Accepted issues the checkers marked WORSE in the patched candidate.
   *
   * Named for what it can see. The check reads checker verdicts keyed by
   * existing accepted issue ids, so a wholly new defect the patch introduces
   * has nowhere to be counted; only a known issue can regress here. Counting
   * genuinely new defects would need a check that does not exist yet, and the
   * old name (`regressionCount`, documented as "new defects") promised one.
   */
  readonly regressedKnownIssues: number;

  /**
   * Total size of the regions the patch touched, larger side of each;
   * smaller is more conservative.
   *
   * Not a count of differing characters, which the old name
   * (`changedCharCount`) claimed: it sums each touched envelope's replaced or
   * replacing length, whichever is longer, so a one-word fix inside a merged
   * envelope serving several issues scores as the whole envelope.
   */
  readonly touchedRegionChars: number;
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
  regressedKnownIssues: 0,
  touchedRegionChars: 0,
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
  if (l.regressedKnownIssues !== r.regressedKnownIssues)
    return l.regressedKnownIssues - r.regressedKnownIssues;
  if (l.resolvedTotal !== r.resolvedTotal)
    return r.resolvedTotal - l.resolvedTotal;
  if (l.touchedRegionChars !== r.touchedRegionChars)
    return l.touchedRegionChars - r.touchedRegionChars;
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
 * Whether a winning candidate actually changed the archive text.
 *
 * NOT the same question as which candidate won, and the difference is a real
 * outcome rather than a formality. The patch gate refuses an operation that
 * rewrites its region to itself, but two operations in adjacent envelopes can
 * each change their own region and still concatenate back to the archive text,
 * exactly as two adjacent slices can at the document level. A patch that wins
 * selection and writes no byte is a slice nothing happened in, and reporting it
 * as changed would put it in the shipped set beside text nobody touched.
 *
 * Read at the outcome rather than asserted against, so
 * `changed === (repairedText !== incumbentText)` holds by construction on this
 * lane, as it already does on the translate lane. The assembly assertions stay
 * as a backstop for routes nobody has thought of.
 *
 * @param winner - candidate selection settled on
 *
 * @param incumbentText - archive wording of this slice
 *
 * @returns Whether the returned text differs from the archive's
 *
 * @example
 * ```ts
 * const changed = winnerChangedText({ winner: selection.winner, incumbentText, },);
 * ```
 */
export function winnerChangedText(
  {
    winner,
    incumbentText,
  }: {
    readonly winner: RepairCandidate;
    readonly incumbentText: string;
  },
): boolean {
  return (winner.candidateId !== UNCHANGED_CANDIDATE_ID)
    && (winner.text !== incumbentText);
}

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
