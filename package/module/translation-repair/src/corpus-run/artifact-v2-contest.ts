import {
  LANE_CONTEST_QUORUM,
  type LaneContestOutcome,
} from '../lane-contest-stage.ts';
import type { LaneContestBallot, } from '../lane-contest-wire.ts';
import type { ArtifactComparisonRowV2, } from './artifact-v2-vocabulary.ts';

//region Lane contest record
// What the roster settled at each slice where the two lanes offer different
// wording, as the settled artifact records it.
//
// WHY THE VERDICT IS A KIND RATHER THAN THE STAGE`S RAW `choice`. The contest
// answers `neither` in two unrelated situations: a roster that heard enough
// voices and still backed no candidate, and a roster too few of whose voices
// arrived to settle anything at all. Recording the raw answer would merge them,
// so a reader asking how often the contest refused both lanes would be counting
// silence as refusal. They are kept apart here, and an unsettled slice lands on
// the same footing as a win, ballots included, for the same reason the repair
// lane records its declined rounds.

/**
 * What the roster settled at one contested slice.
 *
 * @example
 * ```ts
 * const verdict: ArtifactContestVerdictV2 = { kind: 'lane-won', lane: 'repair', };
 * ```
 */
export type ArtifactContestVerdictV2 =
  | {
    /**
     * One lane outpolled the other with enough voices behind it.
     */
    readonly kind: 'lane-won';

    /**
     * Lane those voices backed.
     */
    readonly lane: 'repair' | 'translate';
  }
  | {
    /**
     * Enough voices were heard and none of the lanes carried them, which
     * includes a tie: the stage ships nothing on one by design.
     */
    readonly kind: 'settled-neither';
  }
  | {
    /**
     * Too few voices arrived to settle anything, so nothing was decided here
     * and the slice is not evidence about either lane.
     */
    readonly kind: 'quorum-not-met';
  };

/**
 * One contested slice as the roster left it.
 *
 * @example
 * ```ts
 * const slice: ArtifactContestSliceV2 = { chunkIndex: 0, verdict: { kind: 'settled-neither', }, ballots: [], usable: 0, };
 * ```
 */
export type ArtifactContestSliceV2 = {
  /**
   * Slice both lanes name it by, matching the comparison row it answers.
   */
  readonly chunkIndex: number;

  /**
   * What the roster settled here.
   */
  readonly verdict: ArtifactContestVerdictV2;

  /**
   * Every usable ballot, for the audit trail rather than for the verdict.
   *
   * KEPT ON EVERY VERDICT, including the two that ship nothing. A reader asking
   * why a slice shipped neither lane needs the reasons the judges gave, and a
   * record that carried ballots only for wins would answer that question with
   * silence exactly where it is being asked.
   */
  readonly ballots: readonly LaneContestBallot[];

  /**
   * Voices whose answer arrived and could be read as a ballot, which is what
   * the quorum is measured against.
   */
  readonly usable: number;
};

/**
 * Reads the artifact`s verdict out of what the contest stage returned.
 *
 * @param chunkIndex - slice this answers
 *
 * @param outcome - what the roster settled
 *
 * @returns Record for one contested slice
 *
 * @example
 * ```ts
 * const slice = describeContestSlice({ chunkIndex: 0, outcome, },);
 * ```
 */
export function describeContestSlice(
  {
    chunkIndex,
    outcome,
  }: {
    readonly chunkIndex: number;
    readonly outcome: LaneContestOutcome;
  },
): ArtifactContestSliceV2 {
  /**
   * What the roster settled, read against the same quorum the stage applied
   * rather than against a copy of the number, so the two cannot drift.
   */
  const verdict: ArtifactContestVerdictV2 = (outcome.usable < LANE_CONTEST_QUORUM)
    ? { kind: 'quorum-not-met', }
    : ((outcome.choice === 'neither')
      ? { kind: 'settled-neither', }
      : {
        kind: 'lane-won',
        lane: outcome.choice,
      });
  return {
    chunkIndex,
    verdict,
    ballots: outcome.ballots,
    usable: outcome.usable,
  };
}

/**
 * Names the slices a contest is meaningful at, which are those where the two
 * lanes left different wording.
 *
 * THE TEXTS RATHER THAN THE VERDICT NAME. `both-differ`, `repair-only` and
 * `translate-only` are exactly the verdicts whose two lane texts disagree, and
 * the other three are exactly those where they match, so asking the texts asks
 * the real question and stays right if a verdict is ever added.
 *
 * @param comparison - rows the reader recomputed from both ledgers
 *
 * @returns Slice indexes a contest may answer, in row order
 *
 * @example
 * ```ts
 * const eligible = contestEligibleIndexes({ comparison, },);
 * ```
 */
export function contestEligibleIndexes(
  { comparison, }: { readonly comparison: readonly ArtifactComparisonRowV2[]; },
): readonly number[] {
  return comparison
    .filter(function lanesDiffer(row: ArtifactComparisonRowV2,): boolean {
      return row.repairText !== row.translateText;
    },)
    .map(function nameIt(row: ArtifactComparisonRowV2,): number {
      return row.chunkIndex;
    },);
}

/**
 * Which lane ships, as the settled artifact records it.
 *
 * BOTH KINDS STAY LEGAL. An artifact written before the contest ran carries the
 * pending kind, and dropping it would make every settled artifact unreadable to
 * say something none of them claims. A reader that cannot tell "nobody has
 * asked yet" from "the roster answered" is the defect class this generation
 * exists to end.
 *
 * @example
 * ```ts
 * const selection: ArtifactLaneSelectionV2 = { kind: 'pending-human-decision', };
 * ```
 */
export type ArtifactLaneSelectionV2 =
  | {
    /**
     * The contest has not run over this entry.
     */
    readonly kind: 'pending-human-decision';
  }
  | {
    /**
     * The roster answered every slice where the lanes offer different wording.
     */
    readonly kind: 'contested';

    /**
     * One record per eligible slice, in comparison-row order.
     */
    readonly slices: readonly ArtifactContestSliceV2[];
  };

//endregion Lane contest record
