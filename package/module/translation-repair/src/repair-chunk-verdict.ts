import {
  type CandidateMeasurements,
  type RepairCandidate,
  selectRepairCandidate,
  UNCHANGED_CANDIDATE_ID,
  UNCHANGED_MEASUREMENTS,
  winnerChangedText,
} from './select-candidate.ts';

//region Repair chunk verdict
// What one slice ends up saying about itself: which candidate won, and whether
// the text it returns differs from the archive's.
//
// THOSE ARE TWO QUESTIONS, and a slice answers both. Selection decides whether
// a repair proved itself; the text decides what the document carries. They come
// apart when a patch whose envelope operations cancel wins selection and writes
// no byte, and every count downstream reads one or the other, so a slice that
// conflates them is wrong in one of the two places.

/**
 * What a slice settled on.
 *
 * @example
 * ```ts
 * const verdict: ChunkVerdict = { repairedText, patchSelected: true, changed: true, };
 * ```
 */
export type ChunkVerdict = {
  /**
   * Wording this slice returns, which is the winner's own text.
   */
  readonly repairedText: string;

  /**
   * Whether the patched candidate beat the archive on the measurements.
   */
  readonly patchSelected: boolean;

  /**
   * Whether the returned wording differs from the archive's, which is what
   * assembly and every shipped count read.
   */
  readonly changed: boolean;
};

/**
 * Runs the slate for one slice and reads both verdicts off the winner.
 *
 * The unchanged translation always competes, so it is built here rather than by
 * the caller: an archive that has to be passed in as a candidate is an archive a
 * caller can get wrong, and `selectRepairCandidate` refuses a slate whose
 * unchanged entry carries anything else.
 *
 * @param chunkIndex - slice being settled, which names the patched candidate
 *
 * @param incumbentText - archive wording of this slice
 *
 * @param patchedText - wording the editor produced
 *
 * @param measurements - what the checks and the resolution stage measured about
 * that patched wording
 *
 * @returns Returned wording plus both verdicts
 *
 * @throws {@link Error} when the slate cannot be formed, which cannot happen
 * from here since this function builds it
 *
 * @example
 * ```ts
 * const verdict = settleChunkVerdict({ chunkIndex, incumbentText, patchedText, measurements, },);
 * ```
 */
export function settleChunkVerdict(
  {
    chunkIndex,
    incumbentText,
    patchedText,
    measurements,
  }: {
    readonly chunkIndex: number;
    readonly incumbentText: string;
    readonly patchedText: string;
    readonly measurements: CandidateMeasurements;
  },
): ChunkVerdict {
  /**
   * Archive and repair, ranked against each other.
   */
  const candidates: readonly RepairCandidate[] = [
    {
      candidateId: UNCHANGED_CANDIDATE_ID,
      text: incumbentText,
      measurements: UNCHANGED_MEASUREMENTS,
    },
    {
      candidateId: `candidate/chunk-${String(chunkIndex,)}`,
      text: patchedText,
      measurements,
    },
  ];

  /**
   * Selection between them.
   */
  const selection = selectRepairCandidate({
    candidates,
    incumbentText,
  },);
  return {
    repairedText: selection.winner
      .text,
    patchSelected: selection.winner
      .candidateId
      !== UNCHANGED_CANDIDATE_ID,
    changed: winnerChangedText({
      winner: selection.winner,
      incumbentText,
    },),
  };
}

//endregion Repair chunk verdict
