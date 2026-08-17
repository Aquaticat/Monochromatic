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
//
// EVERY LINE NAMES HOW ITS SLICE WAS LEFT, because the paths cost wildly
// different things and only one of them answers the question. A slice resumed
// from cache costs near zero and bought nothing; a slice nothing translated
// bought nothing either. Averaging those in with slices that were actually
// computed reports a per-slice cost describing no path at all, and the mistake
// is invisible, since a cheap run and a well cached one look identical.

/**
 * Every lane that can pay for a slice.
 *
 * DECLARED AS VALUES with the type derived from them, rather than the other way
 * round, because the reader validates against this list and the writer is typed
 * by it. Two hand-kept copies would drift the moment a lane is added, and the
 * failure would be a reader silently refusing lines a lane really writes.
 *
 * @example
 * ```ts
 * const known = SLICE_COST_LANES.includes(raw,);
 * ```
 */
export const SLICE_COST_LANES = [
  'translate',
  'repair',
] as const;

/**
 * Which lane paid for a slice.
 *
 * @example
 * ```ts
 * const lane: SliceCostLane = 'translate';
 * ```
 */
export type SliceCostLane = typeof SLICE_COST_LANES[number];

/**
 * Every way a lane can leave a slice, kept as values for the same reason
 * {@link SLICE_COST_LANES} is.
 *
 * @example
 * ```ts
 * const known = SLICE_COST_EXITS.includes(raw,);
 * ```
 */
export const SLICE_COST_EXITS = [
  'computed',
  'resumed',
  'no-translation',
  'unfilled',
  'aborted',
] as const;

/**
 * How a lane left one slice, which decides whether its cost is a measurement of
 * anything.
 *
 * Only `computed` prices work. `resumed` answered from cache, `no-translation`
 * found nothing to repair, and `unfilled` bought calls that produced no usable
 * candidate, so its time is real but prices a failure rather than a slice.
 * `aborted` was cut mid-flight, so its time prices the deadline.
 *
 * @example
 * ```ts
 * const exit: SliceCostExit = 'resumed';
 * ```
 */
export type SliceCostExit = typeof SLICE_COST_EXITS[number];

/**
 * Exit assumed when a lane leaves a slice without naming one, which is the
 * ordinary path through both loop bodies.
 */
const DEFAULT_EXIT: SliceCostExit = 'computed';

/**
 * Exit assumed when a lane leaves a slice without naming one WHILE THE RUN IS
 * BEING TORN DOWN.
 *
 * Read from the signal rather than named at each throw site, deliberately. A
 * slice can leave its loop body by throwing from several places (an abort check
 * before the stages, the stages themselves, an assertion after them), and
 * `Symbol.dispose` is not told which exception took it there. Naming each site
 * would record whichever ones someone remembered, which is the failure the
 * scope binding exists to avoid.
 */
const ABORTED_EXIT: SliceCostExit = 'aborted';

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
  readonly [Symbol.dispose]: () => void;

  /**
   * Names how this slice was left, for a path that is not ordinary completion.
   *
   * Called BEFORE leaving, since the report is written on scope exit and cannot
   * ask afterwards which branch took it there. Calling more than once keeps the
   * last name, so a path that refines its own answer reports the refined one.
   */
  readonly left: ({ exit, }: { readonly exit: SliceCostExit; },) => void;
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
 * @param signal - run's abort, read on scope exit so a slice cut mid-flight
 * reports itself rather than passing as ordinary work
 *
 * @returns Measurement reporting on scope exit
 *
 * @example
 * ```ts
 * using span = armSliceCost({ l: rl, lane: 'repair', chunkIndex: 3, sourceChars: 812, signal, },);
 * ```
 */
export function armSliceCost(
  {
    l,
    lane,
    chunkIndex,
    sourceChars,
    signal,
  }: {
    readonly l: Logger;
    readonly lane: SliceCostLane;
    readonly chunkIndex: number;
    readonly sourceChars: number;
    readonly signal: AbortSignal;
  },
): SliceCostSpan {
  /**
   * When this slice began, against which the report is measured.
   */
  const startedAt = Date.now();

  /**
   * How this slice was left, until a path says otherwise.
   *
   * A NAMED CELL rather than a bare binding, because this value is written by
   * one function and read by another, which makes it state the measurement
   * holds rather than a local of either.
   */
  const taken = { exit: DEFAULT_EXIT, };

  return {
    left({ exit: named, },): void {
      taken.exit = named;
    },
    [Symbol.dispose](): void {
      /**
       * Exit this line reports.
       *
       * A NAMED PATH WINS over the signal, since a lane that said `resumed`
       * bought nothing whether the run was later torn down or not. Only a slice
       * that named nothing can have been cut mid-flight.
       */
      const exit = ((taken.exit === DEFAULT_EXIT) && signal.aborted)
        ? ABORTED_EXIT
        : taken.exit;

      l.info(
        `${SLICE_COST_MARKER} lane=${lane} chunk=${String(chunkIndex,)} sourceChars=${
          String(sourceChars,)
        } ms=${String(Date.now() - startedAt,)} exit=${exit}`,
      );
    },
  };
}

//endregion Slice cost log
