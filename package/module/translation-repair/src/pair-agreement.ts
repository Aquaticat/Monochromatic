//region Pair agreement
// WHICH PAIRS THE ROSTER AGREED ON, counted over every usable voice.
//
// `#245`: both pairing stages tallied votes over every reply but took their
// candidates from the FIRST usable reply alone, so a correspondence two other
// voices named was dropped whenever the first voice omitted it, and which
// pairs survived depended on which seat answered usably first. Agreement is
// per pair: a pair named by enough voices survives whoever named it.
//
// STRICTLY INCREASING ON BOTH SIDES is what the step builders downstream
// require, and one reply's pairs already are. A union of several replies need
// not be: two voices can name one source against two targets, or a pair that
// runs backwards against its neighbours. Both are resolved here, by votes and
// then by order, with a finding for every pair that was agreed and still
// could not be kept, so the loss is on the record.

/**
 * A correspondence between one source position and one target position.
 *
 * @example
 * ```ts
 * const pair: IndexPair = { source: 3, target: 4, };
 * ```
 */
export type IndexPair = {
  readonly source: number;
  readonly target: number;
};

/**
 * One pair with the number of voices that named it.
 */
type VotedPair<PairT extends IndexPair,> = {
  readonly pair: PairT;
  readonly votes: number;
};

/**
 * Pairs the roster agreed on, with the findings for agreed pairs that could
 * not be kept.
 *
 * @example
 * ```ts
 * const { pairs, findings, } = agreePairs({ pairings, needed: 2, },);
 * ```
 */
export type PairAgreement<PairT extends IndexPair,> = {
  /**
   * Agreed pairs, strictly increasing on both sides.
   */
  readonly pairs: readonly PairT[];

  /**
   * One line per agreed pair that was dropped, naming why.
   */
  readonly findings: readonly string[];
};

/**
 * Counts every distinct pair across every voice's pairing.
 *
 * @param pairings - one pairing per usable voice
 *
 * @returns Distinct pairs with their vote counts, in first-named order
 *
 * @example
 * ```ts
 * const voted = countAcrossVoices({ pairings, },);
 * ```
 */
function countAcrossVoices<PairT extends IndexPair,>(
  { pairings, }: { readonly pairings: readonly (readonly PairT[])[]; },
): readonly VotedPair<PairT>[] {
  /**
   * Votes per pair, keyed by both positions, the pair object kept from its
   * first naming.
   */
  const byKey = new Map<string, VotedPair<PairT>>();
  for (const pairing of pairings)
    for (const pair of pairing) {
      /**
       * Key naming both positions.
       */
      const key = `${String(pair.source,)},${String(pair.target,)}`;
      /**
       * Count so far, absent on first naming.
       */
      const seen = byKey.get(key,);
      byKey.set(
        key,
        {
          pair,
          votes: (seen?.votes ?? 0) + 1,
        },
      );
    }
  return [...byKey.values(),];
}

/**
 * Of the candidates naming one source, the one to keep: the best-voted, or
 * none when the best is tied.
 *
 * @param candidates - agreed pairs sharing a source
 *
 * @returns The winner alone, or nothing for a tie or no candidate
 *
 * @example
 * ```ts
 * const winner = bestVoted({ candidates, },);
 * ```
 */
function bestVoted<PairT extends IndexPair,>(
  { candidates, }: { readonly candidates: readonly VotedPair<PairT>[]; },
): readonly VotedPair<PairT>[] {
  /**
   * Candidates from the most-voted down.
   */
  const ranked = candidates.toSorted(function byVotesDesc(
    left,
    right,
  ): number {
    return right.votes - left.votes;
  },);
  /**
   * The two best, either possibly absent.
   */
  const [first, second,] = ranked;
  if (first === undefined)
    return [];
  if ((second !== undefined) && (second.votes === first.votes))
    return [];
  return [first,];
}

/**
 * Pairs enough voices named, kept strictly increasing on both sides.
 *
 * @param pairings - one pairing per usable voice
 *
 * @param needed - voices a pair needs to count as agreed
 *
 * @returns Agreed pairs in source order, plus a finding per agreed pair dropped
 *
 * @example
 * ```ts
 * const agreement = agreePairs({ pairings, needed: 2, },);
 * ```
 */
export function agreePairs<PairT extends IndexPair,>(
  {
    pairings,
    needed,
  }: {
    readonly pairings: readonly (readonly PairT[])[];
    readonly needed: number;
  },
): PairAgreement<PairT> {
  /**
   * Agreed pairs in source, then target, order.
   */
  const agreed = countAcrossVoices({ pairings, },)
    .filter(function enoughAgree(voted,): boolean {
      return voted.votes >= needed;
    },)
    .toSorted(function bySourceThenTarget(
      left,
      right,
    ): number {
      /**
       * Pair on the left of the comparison.
       */
      const { pair: before, } = left;
      /**
       * Pair on the right of the comparison.
       */
      const { pair: after, } = right;
      return (before.source - after.source) || (before.target - after.target);
    },);

  /**
   * Source of every agreed pair, in order, repeats included.
   */
  const named = agreed.map(function toSource(voted,): number {
    /**
     * Pair this vote names.
     */
    const { pair, } = voted;
    return pair.source;
  },);

  /**
   * Distinct sources in ascending order.
   */
  const sources = [...new Set(named,),];

  /**
   * Pairs kept so far, strictly increasing.
   */
  const kept: PairT[] = [];

  /**
   * Findings for agreed pairs that could not be kept.
   */
  const findings: string[] = [];

  for (const source of sources) {
    /**
     * Agreed pairs naming this source.
     */
    const candidates = agreed.filter(function namesSource(voted,): boolean {
      /**
       * Pair this vote names.
       */
      const { pair, } = voted;
      return pair.source === source;
    },);
    /**
     * The one to keep for this source, absent on a tie.
     */
    const [winner,] = bestVoted({ candidates, },);
    if (winner === undefined) {
      findings.push(`contested (source ${String(source,)} named against ${String(candidates.length,)} targets)`,);
      continue;
    }
    /**
     * Last pair kept, absent before the first.
     */
    const last = kept.at(-1,);
    /**
     * Target of the last pair kept, below every target when none is kept yet.
     */
    const lastTarget = (last === undefined) ? (-1) : last.target;
    /**
     * Pair the winner names.
     */
    const { pair: chosen, } = winner;
    if (chosen.target <= lastTarget) {
      findings.push(
        `non-monotone (${String(source,)},${String(chosen.target,)} runs back behind ${String(lastTarget,)})`,
      );
      continue;
    }
    kept.push(chosen,);
  }
  return {
    pairs: kept,
    findings,
  };
}

//endregion Pair agreement
