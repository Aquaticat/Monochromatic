import type { WindowTrialRow, } from './window-trial-ledger.ts';

//region Window trial report
// What the window trial's rows mean, computed in one place so no reader has to
// re-derive it and derive it differently.
//
// THE READING IS THE RISKY PART, more than the running. This measurement has
// already been designed wrong twice on paper: once as two arms, which cannot
// separate the window from a resampled slate, and once with a band taken from a
// single repeat, which understates the noise it is meant to bound. Both were
// caught before any quota was spent. What survives here is the discipline those
// corrections produced.
//
// ONLY COMPLETE TRIPLES ARE ANALYSED. A slice is read only when all three arms
// exist for it: the two narrow runs and the wide one. A slice missing an arm is
// counted and excluded, never partially credited, because every number below is
// a PAIRED comparison on one slice and a half-populated pair is not a smaller
// sample, it is a different one.

/**
 * Arm names the trial buys, and the only ones this report reads.
 *
 * TWO NARROW ARMS ON PURPOSE. Their difference is the run-to-run band, and
 * without it the narrow-to-wide difference has nothing to be judged against.
 */
export const TRIAL_ARMS = {
  narrowFirst: 'narrow-a',
  narrowSecond: 'narrow-b',
  wide: 'wide',
} as const;

/**
 * How one arm fared over one class of slice.
 *
 * @example
 * ```ts
 * const rates: ArmRate = { arm: 'wide', trials: 22, replaced: 9, };
 * ```
 */
export type ArmRate = {
  /**
   * Arm these counts are for.
   */
  readonly arm: string;

  /**
   * Slices this arm was read over, which is the complete-triple population.
   */
  readonly trials: number;

  /**
   * How many of them this arm replaced the archive on.
   */
  readonly replaced: number;
};

/**
 * How the wide arm moved against the first narrow arm, slice by slice.
 *
 * PAIRED COUNTS RATHER THAN TWO RATES, because two rates that match can hide
 * equal traffic in both directions, and traffic in both directions is not the
 * window working. This is the shape that distinguishes them.
 *
 * @example
 * ```ts
 * const moved: Transitions = { replaceToKeep: 4, keepToReplace: 1, heldReplace: 10, heldKeep: 7, };
 * ```
 */
export type Transitions = {
  /**
   * Slices the narrow arm replaced and the wide arm kept, which is the
   * direction `#107` predicts if displacement drives replacement.
   */
  readonly replaceToKeep: number;

  /**
   * Slices the narrow arm kept and the wide arm replaced.
   */
  readonly keepToReplace: number;

  /**
   * Slices both replaced.
   */
  readonly heldReplace: number;

  /**
   * Slices neither replaced.
   */
  readonly heldKeep: number;
};

/**
 * Everything the trial says about one class of slice.
 *
 * @example
 * ```ts
 * const report: ClassReport = { sliceClass: 'relocation', arms: [], transitions, bandTransitions, incomplete: 0, };
 * ```
 */
export type ClassReport = {
  /**
   * Class the displacement screen flagged, or the control label.
   */
  readonly sliceClass: string;

  /**
   * Each arm's replacement count over the complete-triple population.
   */
  readonly arms: readonly ArmRate[];

  /**
   * How the wide arm moved against the first narrow arm.
   */
  readonly transitions: Transitions;

  /**
   * How the SECOND NARROW ARM moved against the first.
   *
   * THIS IS THE BAND, and it is the number the one above must beat. Both narrow
   * arms were shown the same evidence over the same slate, so every transition
   * here is noise by construction. A wide arm that moves no more than this has
   * moved nothing.
   */
  readonly bandTransitions: Transitions;

  /**
   * Slices excluded for missing an arm, so a reader can see how much of the
   * class the analysis covers.
   */
  readonly incomplete: number;
};

/**
 * Counts one arm's replacements over a set of complete triples.
 *
 * @param triples - slices with all three arms
 *
 * @param arm - arm to count
 *
 * @returns That arm's trial and replacement counts
 *
 * @example
 * ```ts
 * const rate = rateOf({ triples, arm: TRIAL_ARMS.wide, },);
 * ```
 */
function rateOf(
  {
    triples,
    arm,
  }: {
    readonly triples: readonly ReadonlyMap<string, WindowTrialRow>[];
    readonly arm: string;
  },
): ArmRate {
  return {
    arm,
    trials: triples.length,
    replaced: triples.filter(function replacedHere(triple,): boolean {
      return triple.get(arm,)
        ?.shipped
        === true;
    },)
      .length,
  };
}

/**
 * Counts how one arm moved against another, slice by slice.
 *
 * @param triples - slices with all three arms
 *
 * @param from - arm the comparison starts at
 *
 * @param to - arm it moves to
 *
 * @returns Paired transition counts
 *
 * @example
 * ```ts
 * const moved = transitionsBetween({ triples, from: TRIAL_ARMS.narrowFirst, to: TRIAL_ARMS.wide, },);
 * ```
 */
function transitionsBetween(
  {
    triples,
    from,
    to,
  }: {
    readonly triples: readonly ReadonlyMap<string, WindowTrialRow>[];
    readonly from: string;
    readonly to: string;
  },
): Transitions {
  /**
   * Each slice as a pair of booleans, which is all a transition reads.
   */
  const moves = triples.map(function toMove(triple,): readonly [
    boolean,
    boolean,
  ] {
    return [
      triple.get(from,)
        ?.shipped
        === true,
      triple.get(to,)
        ?.shipped
        === true,
    ];
  },);

  return {
    replaceToKeep: moves.filter(function fell([before, after,],): boolean {
      return before && (!after);
    },)
      .length,
    keepToReplace: moves.filter(function rose([before, after,],): boolean {
      return (!before) && after;
    },)
      .length,
    heldReplace: moves.filter(function both([before, after,],): boolean {
      return before && after;
    },)
      .length,
    heldKeep: moves.filter(function neither([before, after,],): boolean {
      return (!before) && (!after);
    },)
      .length,
  };
}

/**
 * Groups one class's rows into per-slice arm maps.
 *
 * @param rows - rows of one class
 *
 * @returns One map per slice, keyed by arm
 *
 * @example
 * ```ts
 * const bySlice = groupBySlice({ rows, },);
 * ```
 */
function groupBySlice(
  { rows, }: { readonly rows: readonly WindowTrialRow[]; },
): readonly ReadonlyMap<string, WindowTrialRow>[] {
  /**
   * Arms per slice, keyed by entry and slice together since two entries can
   * both carry a slice at the same index.
   */
  const bySlice = new Map<string, Map<string, WindowTrialRow>>();
  for (const row of rows) {
    /**
     * This slice's identity across entries.
     */
    const key = `${row.entryId} ${String(row.chunkIndex,)}`;

    /**
     * Arms recorded for it so far.
     */
    const arms = bySlice.get(key,) ?? new Map<string, WindowTrialRow>();
    arms.set(
      row.arm,
      row,
    );
    bySlice.set(
      key,
      arms,
    );
  }
  return [...bySlice.values(),];
}

/**
 * Reports what the trial found, one entry per class.
 *
 * @param rows - every completed arm, from the ledger
 *
 * @returns One report per class present in the rows
 *
 * @example
 * ```ts
 * const reports = reportWindowTrial({ rows, },);
 * ```
 */
export function reportWindowTrial(
  { rows, }: { readonly rows: readonly WindowTrialRow[]; },
): readonly ClassReport[] {
  /**
   * Classes present, so a report covers what was run rather than what was
   * expected to run.
   */
  const classes = [...new Set(rows.map(function toClass(row,): string {
    return row.sliceClass;
  },),),];

  return classes.map(function toReport(sliceClass,): ClassReport {
    /**
     * Every slice of this class, as arm maps.
     */
    const bySlice = groupBySlice({ rows: rows.filter(function inClass(row,): boolean {
      return row.sliceClass === sliceClass;
    },), },);

    /**
     * Slices carrying all three arms, which is the only population read.
     */
    const triples = bySlice.filter(function complete(arms,): boolean {
      return arms.has(TRIAL_ARMS.narrowFirst,)
        && arms.has(TRIAL_ARMS.narrowSecond,)
        && arms.has(TRIAL_ARMS.wide,);
    },);

    return {
      sliceClass,
      arms: [
        TRIAL_ARMS.narrowFirst,
        TRIAL_ARMS.narrowSecond,
        TRIAL_ARMS.wide,
      ].map(function toRate(arm,): ArmRate {
        return rateOf({
          triples,
          arm,
        },);
      },),
      transitions: transitionsBetween({
        triples,
        from: TRIAL_ARMS.narrowFirst,
        to: TRIAL_ARMS.wide,
      },),
      bandTransitions: transitionsBetween({
        triples,
        from: TRIAL_ARMS.narrowFirst,
        to: TRIAL_ARMS.narrowSecond,
      },),
      incomplete: bySlice.length - triples.length,
    };
  },);
}

//endregion Window trial report
