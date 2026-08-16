import type { LaneSliceText, } from './lane-slice-text.ts';

//region Wording coherence
// The rule tying a lane's OUTCOME to the archive's own state at the same slice.
//
// `LaneSliceText` carries two independent axes on purpose, and independent is
// not unconstrained: three of their combinations describe a slice that cannot
// exist. `buildLaneSliceTexts` refuses all three while it is building, but it
// is not the only way a wording reaches a consumer. The type is exported, the
// delivery ledger and the lane comparison both take wordings from a caller, and
// an artifact reader will take them from disk. Each of those is a boundary
// where the producer's checks are somebody else's assumption.
//
// So the rule lives here rather than inside the builder, and every boundary
// asserts it for itself. The cost is one pass over the slices; what it buys is
// that no reader has to trust the writer.

/**
 * Raised when one slice's outcome contradicts what the archive holds there.
 *
 * SEPARATE FROM COVERAGE. A coverage failure means the lane and the preparation
 * disagree about which slices exist; this means one wording disagrees with
 * itself, which no join or count could detect afterwards because every field is
 * individually well formed.
 *
 * @example
 * ```ts
 * throw new WordingCoherenceError({ message: 'slice 4 falls back on wording the archive lacks', },);
 * ```
 */
export class WordingCoherenceError extends Error {
  /**
   * Builds the error with a message naming the slice and the contradiction.
   *
   * @param message - what contradicts what, naming the slice index
   *
   * @example
   * ```ts
   * throw new WordingCoherenceError({ message: 'slice 4 falls back on wording the archive lacks', },);
   * ```
   */
  constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'WordingCoherenceError';
  }
}

/**
 * Refuses a wording whose outcome and incumbent describe different slices.
 *
 * @param wording - one lane's record of one slice, naming both what the lane
 * did and whether the archive holds anything there
 *
 * @throws {@link WordingCoherenceError} when the lane falls back on an
 * incumbent that does not exist, reports a passage the archive translates as
 * unfilled, or claims a decision that filled a gap with nothing
 *
 * @example
 * ```ts
 * assertWordingCoherent({ wording, },);
 * ```
 */
export function assertWordingCoherent(
  { wording, }: { readonly wording: LaneSliceText; },
): void {
  /**
   * Slice being checked, named in every message so a failure points at a row.
   */
  const at = `slice ${String(wording.chunkIndex,)}`;

  /**
   * What the lane did here, and whether the archive holds anything here, which
   * are the two axes this rule relates.
   */
  const {
    outcome,
    incumbentKind,
  } = wording;

  // NOTHING TO FALL BACK ON. `incumbent-fallback` says the archive's own
  // wording stands here because nobody produced one; at a place the archive
  // never translated, that reports a passage as covered by wording that does
  // not exist.
  if ((outcome.kind === 'incumbent-fallback') && (incumbentKind === 'absent')) {
    throw new WordingCoherenceError({
      message: `${at} reports the archive's wording standing by default, and the archive holds none`,
    },);
  }

  // THE MIRROR. `unfilled` says the passage is missing and always was; at a
  // slice the archive does translate, it reports a passage the archive covers
  // as one it never did, and every count of missing passages inherits that.
  if ((outcome.kind === 'unfilled') && (incumbentKind === 'present')) {
    throw new WordingCoherenceError({
      message: `${at} reports a missing passage, and the archive holds wording for it`,
    },);
  }

  // THE OTHER MIRROR. `not-applicable` says this lane had no input here, and
  // the only slice a lane can have no input at is one the archive never
  // translated: at a slice it did translate, the lane's work applies by
  // definition and declining it is a choice rather than a structural fact.
  if ((outcome.kind === 'not-applicable') && (incumbentKind === 'present')) {
    throw new WordingCoherenceError({
      message: `${at} reports this lane having nothing to work on, and the archive holds wording there`,
    },);
  }

  // A DECISION THAT DECIDED NOTHING, at a place with nothing already. The
  // wording is empty and so is the archive, so the document carries the gap it
  // had; calling that a decision credits the lane with filling a passage it
  // left exactly as it found it.
  if ((outcome.kind === 'decided')
    && (incumbentKind === 'absent')
    && (outcome.acceptedText === '')) {
    throw new WordingCoherenceError({
      message: `${at} reports a decision of empty wording where the archive holds none, `
        + 'so nothing was filled and nothing distinguishes it from a passage still missing',
    },);
  }

  // NOT AN OUTCOME RULE AT ALL, and here because this is where the two axes
  // meet. An anchor names a boundary and carries no text by construction, so
  // wording recorded beside `absent` came from somewhere else: a preparation
  // that has since changed, or a row assembled from two.
  if ((incumbentKind === 'absent') && (wording.incumbentText !== '')) {
    throw new WordingCoherenceError({
      message: `${at} says the archive holds no wording and carries some anyway, `
        + 'so the two sides of this row were built from different preparations',
    },);
  }
}

//endregion Wording coherence
