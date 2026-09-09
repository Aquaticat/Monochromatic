import { rosterQuorumSize, } from './roster-quorum-size.ts';

//region Reachable quorum
// A QUORUM IS SIZED ON THE SEATS THAT COULD ANSWER, not on the seats the phase
// seated. The owner's decision of 2026-09-09 (a deciding bench short of quorum
// decides by a share of the reachable weight, with a two-ballot floor) reached
// the select minimum first (`candidate-select-minimum.ts`); this is the same
// rule for the gather itself, so a stage whose bench lost seats to a provider
// drying mid-phase closes on the seats a wet provider serves instead of
// chasing a quorum those seats cannot reach.
//
// WHY IT EXISTS. On 2026-09-09 at 20:23 UTC the seat reader read Synthetic
// wet at 0.04 percent of its week and seated Qwen3.8-27B and Kimi-K3; the
// provider refused at 20:25, the router named those two and the dark
// `glm-5.3` unreachable, and the archive block review of `hulicaijia` sized
// its quorum at 6 of 11, heard 5, spent its retry rounds re-asking the three
// refused seats, and interrupted the entry provider-unavailable at 382 s.
//
// THE FLOOR IS TWO VOICES, as the select minimum's is two ballots: no stage
// is decided by a single model, and a bench with one reachable seat, or none,
// is an outage rather than a quorum.

/**
 * Fewest heard voices a stage may close on, whatever the bench.
 */
export const MIN_STAGE_VOICES = 2;

/**
 * Quorum a gather needs once the seats no provider serves are known.
 *
 * @example
 * ```ts
 * const quorum: ReachableQuorum = reachableQuorum({ benchSize: 11, unreachable: 7, },);
 * ```
 */
export type ReachableQuorum = {
  /**
   * Heard voices the gather needs to close.
   */
  readonly needed: number;

  /**
   * Seats a wet provider could serve.
   */
  readonly reachable: number;

  /**
   * Quorum the seated bench would have needed with every seat reachable.
   */
  readonly benchQuorum: number;

  /**
   * Whether the reachable bench is short of that quorum, which is the only
   * case in which `needed` differs from `benchQuorum`.
   */
  readonly short: boolean;
};

/**
 * Sizes a gather's quorum to the seats that could answer.
 *
 * @param benchSize - seats the stage seated, unreachable seats included
 *
 * @param unreachable - seats the router refused for want of a wet provider
 *
 * @returns Voices needed, the reachable count and bench quorum it was sized
 * by, and whether the bench was short
 *
 * @example
 * ```ts
 * reachableQuorum({ benchSize: 11, unreachable: 7, },);
 * // => { needed: 2, reachable: 4, benchQuorum: 6, short: true, }
 * ```
 */
export function reachableQuorum(
  {
    benchSize,
    unreachable,
  }: {
    readonly benchSize: number;
    readonly unreachable: number;
  },
): ReachableQuorum {
  /**
   * Seats a wet provider could serve.
   */
  const reachable = benchSize - unreachable;

  /**
   * Voices the seated bench needs for a quorum.
   */
  const benchQuorum = rosterQuorumSize({ rosterSize: benchSize, },);
  if (reachable >= benchQuorum) {
    return {
      needed: benchQuorum,
      reachable,
      benchQuorum,
      short: false,
    };
  }
  return {
    needed: Math.max(
      MIN_STAGE_VOICES,
      rosterQuorumSize({ rosterSize: reachable, },),
    ),
    reachable,
    benchQuorum,
    short: true,
  };
}

/**
 * Finding a gather closed short of its bench quorum carries, so an artifact
 * decided on a short bench is told apart in its findings rather than only in
 * a log line.
 *
 * @param stage - stage the gather served
 *
 * @param quorum - quorum the gather applied
 *
 * @param benchSize - seats the stage seated
 *
 * @returns Finding in scorecard-stable wording
 *
 * @example
 * ```ts
 * shortBenchStageFinding({ stage: 'critic', quorum, benchSize: 11, },);
 * // => 'stage-short-bench (critic reachable 4 of 11, quorum 2)'
 * ```
 */
export function shortBenchStageFinding(
  {
    stage,
    quorum,
    benchSize,
  }: {
    readonly stage: string;
    readonly quorum: ReachableQuorum;
    readonly benchSize: number;
  },
): string {
  return `stage-short-bench (${stage} reachable ${String(quorum.reachable,)} of ${String(benchSize,)}, quorum ${
    String(quorum.needed,)
  })`;
}
//endregion Reachable quorum
