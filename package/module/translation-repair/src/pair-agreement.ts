//region Pair agreement
// WHICH PAIRS THE ROSTER AGREED ON, counted over every usable voice.
//
// `#245`: both pairing stages tallied votes over every reply but took their
// candidates from the FIRST usable reply alone, so a correspondence two other
// voices named was dropped whenever the first voice omitted it, and which
// pairs survived depended on which seat answered usably first. Agreement is
// per pair: a pair named by enough voices survives whoever named it.
//
// SECTION PAIRS ARE STRICTLY INCREASING. Block pairs are monotone and may stay
// on one side while the other advances, because paragraph splits and merges are
// first-class correspondences in `pair-blocks-wire.ts`. A repeated-side set is
// kept only when enough voices named its members together, so alternatives from
// disjoint replies do not become invented many-to-many structure.

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
 * Multiplicity pairing consumer can represent.
 *
 * @example
 * ```ts
 * const shape: PairingShape = 'many-to-many';
 * ```
 */
export type PairingShape = 'one-to-one' | 'many-to-many';

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
   * Agreed pairs, strictly increasing for one-to-one and monotone otherwise.
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
 * Reports whether enough voices named every candidate together.
 *
 * @param candidates - pairs whose co-occurrence is being tested
 *
 * @param pairings - one pairing per usable voice
 *
 * @param needed - voices required
 *
 * @returns Whether candidates are corroborated as one relation
 *
 * @example
 * ```ts
 * const together = candidatesCoOccur({ candidates, pairings, needed: 2, });
 * ```
 */
function candidatesCoOccur<PairT extends IndexPair,>(
  {
    candidates,
    pairings,
    needed,
  }: {
    readonly candidates: readonly VotedPair<PairT>[];
    readonly pairings: readonly (readonly PairT[])[];
    readonly needed: number;
  },
): boolean {
  /**
   * Voices naming every candidate as one relation.
   */
  const matching = pairings.filter(function namesEveryCandidate(pairing,): boolean {
    return candidates.every(function namesCandidate(candidate,): boolean {
      /**
       * Candidate pair this voice must name.
       */
      const { pair: candidatePair, } = candidate;
      return pairing.some(function isSamePair(pair,): boolean {
        return (pair.source === candidatePair.source)
          && (pair.target === candidatePair.target);
      },);
    },);
  },);
  return matching.length >= needed;
}

/**
 * Of candidates naming one source, set to keep under consumer multiplicity.
 *
 * @param candidates - agreed pairs sharing source
 *
 * @param pairings - one pairing per usable voice
 *
 * @param needed - voices required
 *
 * @param pairingShape - multiplicity consumer can represent
 *
 * @returns Corroborated set, best-voted singleton, or nothing for tie
 *
 * @example
 * ```ts
 * const winner = bestVoted({ candidates, },);
 * ```
 */
function bestVoted<PairT extends IndexPair,>(
  {
    candidates,
    pairings,
    needed,
    pairingShape,
  }: {
    readonly candidates: readonly VotedPair<PairT>[];
    readonly pairings: readonly (readonly PairT[])[];
    readonly needed: number;
    readonly pairingShape: PairingShape;
  },
): readonly VotedPair<PairT>[] {
  if ((pairingShape === 'many-to-many')
    && candidatesCoOccur({
      candidates,
      pairings,
      needed,
    },))
    return candidates;
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
 * @param pairingShape - multiplicity consumer can represent
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
    pairingShape = 'one-to-one',
  }: {
    readonly pairings: readonly (readonly PairT[])[];
    readonly needed: number;
    readonly pairingShape?: PairingShape;
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
    const winners = bestVoted({
      candidates,
      pairings,
      needed,
      pairingShape,
    },);
    if (winners.length === 0) {
      findings.push(`contested (source ${String(source,)} named against ${String(candidates.length,)} targets)`,);
      continue;
    }
    for (const winner of winners) {
      /**
       * Last pair kept, absent before first.
       */
      const last = kept.at(-1,);
      /**
       * Target of last pair, below every target before first.
       */
      const lastTarget = (last === undefined) ? (-1) : last.target;
      /**
       * Pair this winner names.
       */
      const { pair: chosen, } = winner;
      /**
       * Whether repeated target is corroborated merge in many-to-many mode.
       */
      const repeatedTarget = (last !== undefined)
        && (chosen.target === last.target)
        && (pairingShape === 'many-to-many')
        && candidatesCoOccur({
          candidates: [
            {
              pair: last,
              votes: needed,
            },
            winner,
          ],
          pairings,
          needed,
        },);
      /**
       * Whether this pair stays on previous target.
       */
      const repeatsTarget = chosen.target === lastTarget;
      /**
       * Equal target unsupported as merge.
       */
      const doesNotAdvance = repeatsTarget ? !repeatedTarget : false;
      if ((chosen.target < lastTarget) || doesNotAdvance) {
        findings.push(
          `non-monotone (${String(source,)},${String(chosen.target,)} runs back behind ${String(lastTarget,)})`,
        );
        continue;
      }
      kept.push(chosen,);
    }
  }
  return {
    pairs: kept,
    findings,
  };
}

//endregion Pair agreement
