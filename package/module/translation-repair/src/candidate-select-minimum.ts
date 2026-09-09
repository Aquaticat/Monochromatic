import { MIN_SELECTION_WEIGHT, } from './candidate-select-model.ts';
import { rosterQuorumSize, } from './roster-quorum-size.ts';

//region Selection minimum on a short bench
// THE OWNER'S DECISION OF 2026-09-09 (`translation-repair-short-bench-share.md`),
// on the second noname and the sixth Mio on Bedrock alone: a deciding bench
// short of quorum seats a winner by a share of the reachable weight rather
// than the absolute minimum, keeping two ballots as the floor against one
// judge deciding. `judgeSeatsFor` keeps a seat on the bench when no wet
// provider serves it and the router refuses the call, so a Bedrock-alone
// round seated eleven and heard three; under an absolute 2 a winner there
// needed every reachable judge, or two disinterested ones where a producer
// sat, and the heading stayed unfilled.
//
// THE SHARE IS NOT A NUMBER ANYONE CHOSE. It is the share of a quorum bench
// that `MIN_SELECTION_WEIGHT` already is: quorum over the seated bench is
// `rosterQuorumSize`, as in every other stage, and the minimum scales by
// reachable over quorum. A bench at or above quorum keeps the absolute
// minimum exactly, so the archive-block review's four seats, every fixture
// and the full production bench are unchanged.

/**
 * Ballots naming the winner a selection needs whatever its weight.
 *
 * The ballot form of the same floor the absolute minimum stood for: one vote
 * deciding is one model deciding, which the ensemble exists to prevent. On a
 * bench at quorum a weight of {@link MIN_SELECTION_WEIGHT} already implies it,
 * since no ballot carries more than one; on a short bench the scaled weight
 * can fall to what one full ballot carries, and this is what stops it.
 */
export const MIN_SELECTION_BALLOTS = 2;

/**
 * What a selection round must see before its leader wins, sized to the bench
 * that could answer.
 *
 * @example
 * ```ts
 * const minimum: SelectionMinimum = { weight: 1, reachable: 3, quorum: 6, short: true, };
 * ```
 */
export type SelectionMinimum = {
  /**
   * Summed ballot weight the leader needs.
   */
  readonly weight: number;

  /**
   * Seats a wet provider could serve: the bench less the seats the router
   * refused.
   */
  readonly reachable: number;

  /**
   * Voices the seated bench needs for a quorum.
   */
  readonly quorum: number;

  /**
   * Whether the reachable bench is short of that quorum, which is the only
   * case in which the weight differs from {@link MIN_SELECTION_WEIGHT}.
   */
  readonly short: boolean;
};

/**
 * Sizes the minimum weight to the seats that could answer.
 *
 * @param benchSize - judges the round seated, unreachable seats included
 *
 * @param unreachable - seats the router refused for want of a wet provider
 *
 * @returns Minimum weight, the reachable count and quorum it was sized by,
 * and whether the bench was short
 *
 * @example
 * ```ts
 * selectionMinimum({ benchSize: 11, unreachable: 8, },);
 * // => { weight: 1, reachable: 3, quorum: 6, short: true, }
 * ```
 */
export function selectionMinimum(
  {
    benchSize,
    unreachable,
  }: {
    readonly benchSize: number;
    readonly unreachable: number;
  },
): SelectionMinimum {
  /**
   * Seats a wet provider could serve.
   */
  const reachable = benchSize - unreachable;

  /**
   * Voices the seated bench needs for a quorum.
   */
  const quorum = rosterQuorumSize({ rosterSize: benchSize, },);
  if (reachable >= quorum) {
    return {
      weight: MIN_SELECTION_WEIGHT,
      reachable,
      quorum,
      short: false,
    };
  }
  return {
    weight: (MIN_SELECTION_WEIGHT * reachable) / quorum,
    reachable,
    quorum,
    short: true,
  };
}

/**
 * Finding a round seated short of quorum carries, so a page decided this way
 * is told apart in its findings rather than only in a log line.
 *
 * @param minimum - minimum the round applied
 *
 * @param benchSize - judges the round seated
 *
 * @returns Finding in scorecard-stable wording
 *
 * @example
 * ```ts
 * shortBenchFinding({ minimum, benchSize: 11, },);
 * // => 'select-short-bench (reachable 3 of 11, minimum 1.00)'
 * ```
 */
export function shortBenchFinding(
  {
    minimum,
    benchSize,
  }: {
    readonly minimum: SelectionMinimum;
    readonly benchSize: number;
  },
): string {
  return `select-short-bench (reachable ${String(minimum.reachable,)} of ${String(benchSize,)}, minimum ${
    minimum.weight
      .toFixed(2,)
  })`;
}

//endregion Selection minimum on a short bench
