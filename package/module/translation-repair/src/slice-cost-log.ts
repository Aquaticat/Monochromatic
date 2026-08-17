import type { Logger, } from '@monochromatic-dev/module-logger/ts';

//region Slice cost log
// Records what one slice cost, so a later reader can ask whether cost scales
// with size (`#92`).
//
// A LOG LINE RATHER THAN AN ARTIFACT FIELD, deliberately. The version 2 artifact
// parser landed on 2026-08-16 and `#96` is an open question about what the
// artifact stores at all, so adding a field now would churn a schema while the
// decision that governs it is unanswered. A line costs nothing to add, nothing
// to parse, and nothing to take back.
//
// THE LINE IS SELF-SUFFICIENT, carrying the lane, the slice, its size and its
// elapsed time. A reader needs the log and nothing else, so whatever `#96`
// decides about artifact contents cannot reach this measurement.
//
// ELAPSED IS WALL TIME AND MEANS SOMETHING because both lanes walk their slices
// SEQUENTIALLY (`translate-document.ts` and `repair-translation.ts` each hold one
// `for (const slice of ...)`). Under concurrency this number would fold in
// waiting on shared rate limits and would not be a per-slice cost at all.

/**
 * Which lane paid for a slice.
 *
 * @example
 * ```ts
 * const lane: SliceCostLane = 'translate';
 * ```
 */
export type SliceCostLane = 'translate' | 'repair';

/**
 * Token every cost line opens with, so a reader can find them among unrelated
 * logging without matching on wording that may be reworded.
 *
 * @example
 * ```ts
 * const isCostLine = line.includes(SLICE_COST_MARKER,);
 * ```
 */
export const SLICE_COST_MARKER = 'SLICE-COST';

/**
 * Open cost measurement, which reports when it leaves scope.
 *
 * @example
 * ```ts
 * using span: SliceCostSpan = armSliceCost({ l, lane: 'repair', chunkIndex, sourceChars, },);
 * ```
 */
export type SliceCostSpan = {
  /**
   * Reports elapsed time for this slice.
   */
  [Symbol.dispose](): void;
};

/**
 * Starts measuring one slice, reporting when the measurement leaves scope.
 *
 * BOUND TO SCOPE RATHER THAN TO A CALL AT THE END, because both lanes leave a
 * slice by more than one path: a cached answer, a slice no lane applies to, and
 * an ordinary completion all exit the same loop body. A closing call would
 * record whichever paths someone remembered.
 *
 * @param l - logger already tagged with the calling lane
 *
 * @param lane - which lane is paying
 *
 * @param chunkIndex - slice this measures, named as every record names it
 *
 * @param sourceChars - size of what was translated, so cost can be read against
 * it
 *
 * @returns Measurement reporting on scope exit
 *
 * @example
 * ```ts
 * using span = armSliceCost({ l: rl, lane: 'repair', chunkIndex: 3, sourceChars: 812, },);
 * ```
 */
export function armSliceCost(
  {
    l,
    lane,
    chunkIndex,
    sourceChars,
  }: {
    readonly l: Logger;
    readonly lane: SliceCostLane;
    readonly chunkIndex: number;
    readonly sourceChars: number;
  },
): SliceCostSpan {
  /**
   * When this slice began, against which the report is measured.
   */
  const startedAt = Date.now();

  return {
    [Symbol.dispose](): void {
      l.info(
        `${SLICE_COST_MARKER} lane=${lane} chunk=${String(chunkIndex,)} sourceChars=${
          String(sourceChars,)
        } ms=${String(Date.now() - startedAt,)}`,
      );
    },
  };
}

//endregion Slice cost log
