//region Lane slice coverage error
// The failure both halves of the wording builder raise, in its own file so they
// can share it without one importing the other.
//
// It was declared beside `buildLaneSliceTexts` while that function owned every
// check. The per-list checks now live in `lane-slice-sets.ts`, which the builder
// calls, so leaving the class behind would have made the two files import each
// other.

/**
 * Raised when a lane reports a decision for a slice its preparation never
 * produced, when it leaves a prepared slice undecided under `refuse`, when it
 * names one slice on two different lists, or when it reaches a slice AFTER an
 * unexamined one under `not-evaluated`.
 *
 * The first two mean the decision list and the slice list were built from
 * different preparations, which no later reader could detect: a comparison
 * would silently join one lane's slice 4 against the other's slice 4 while the
 * two name different passages.
 *
 * The last is a different defect with the same remedy. `not-evaluated` exists
 * for a lane that stopped early by design, so its unexamined slices are a
 * SUFFIX; reaching one after a gap means a slice was dropped from the middle,
 * which an early stop cannot produce.
 *
 * @example
 * ```ts
 * throw new LaneSliceCoverageError({ message: 'slice 4 has no decision', },);
 * ```
 */
export class LaneSliceCoverageError extends Error {
  /**
   * Builds the error with a message naming the slice.
   *
   * @param message - what is missing, naming the slice index
   *
   * @example
   * ```ts
   * throw new LaneSliceCoverageError({ message: 'slice 4 has no decision', },);
   * ```
   */
  constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'LaneSliceCoverageError';
  }
}

//endregion Lane slice coverage error
