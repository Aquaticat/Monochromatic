import type {
  ChunkPair,
  DocumentChunk,
} from './chunk-document.ts';

//region Slice splicing
// Rebuilding a whole translation from per-slice results.
//
// Extracted because the driver assembles TWICE: once to get `T1`, whose
// definitions the naturalness gate needs in order to resolve references, and
// once more to get the text that ships. Two copies of an offset-descending
// splice is exactly the kind of duplication that drifts.
//
// LANE-NEUTRAL. It consumes replacements rather than repair outcomes, because
// the translate lane produces text for slices no repair outcome describes: a
// slice whose translation is absent has nothing repaired and everything to
// write. Reading `changed` off an outcome also asked the wrong question, since
// what assembly needs to know is whether there is text to write here, not
// whether some stage considers its work a change.

/**
 * Text to write over one slice's span.
 *
 * Carries no `changed` flag: presence in the list IS the instruction to apply
 * it, so a lane decides what changed and assembly decides where it goes.
 *
 * @example
 * ```ts
 * const replacement: SliceReplacement = { chunkIndex: 4, replacementText: 'The cat naps.', };
 * ```
 */
export type SliceReplacement = {
  /**
   * Global slice index, as `prepareDocumentPair` stamped it.
   */
  readonly chunkIndex: number;

  /**
   * Text that replaces that slice's target span.
   *
   * May be empty, which deletes the span. May be written into a zero-length
   * span, which inserts at that offset: that is how a slice with no existing
   * translation receives one.
   */
  readonly replacementText: string;
};

/**
 * One replacement joined to the span it names.
 *
 * @example
 * ```ts
 * const placed: PlacedReplacement = { replacement, span: slice.target, };
 * ```
 */
type PlacedReplacement = {
  /**
   * Text to write, as its lane emitted it.
   */
  readonly replacement: SliceReplacement;

  /**
   * Target span it goes into, resolved from the slice list.
   */
  readonly span: DocumentChunk;
};

/**
 * Rebuilds the translation with every replacement written in.
 *
 * Replacements apply in DESCENDING document order, so writing one never shifts
 * the offsets of those still pending. Replacements sharing one offset, which is
 * what several insertions into the same empty span look like, apply in
 * descending slice order for the same reason: each is written before the one
 * that precedes it, leaving them in document order.
 *
 * @param targetText - translation the slices were cut from
 *
 * @param slices - slice pairs in document order
 *
 * @param replacements - text to write, in any order
 *
 * @returns Translation with every replacement applied
 *
 * @throws {@link Error} when a replacement names a slice that does not exist,
 * when two name the same slice, or when two slices carry one index: each means
 * the caller and the slicing disagree, and each silently drops text
 *
 * @example
 * ```ts
 * const assembled = spliceSlices({ targetText, slices, replacements, },);
 * ```
 */
export function spliceSlices(
  {
    targetText,
    slices,
    replacements,
  }: {
    readonly targetText: string;
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
  },
): string {
  /**
   * Target span per slice index, so a replacement is resolved by the index it
   * names rather than by its position in the slice list.
   */
  const spans = new Map(slices.map(function toSpan(slice,) {
    return [
      slice.target
        .chunkIndex,
      slice.target,
    ] as const;
  },),);
  if (spans.size !== slices.length) {
    throw new Error(
      'two slices carry one index: a map keyed by index keeps only the last of '
        + 'them, so one slice becomes unreachable while its replacement lands '
        + 'on the other',
    );
  }

  /**
   * Replacements paired with the span each names, refusing anything that
   * cannot be placed.
   *
   * Resolved BEFORE sorting. Sorting first would have to invent an offset for
   * an unresolvable index, and every fabricated offset orders the rest wrongly
   * while looking like an ordinary sort.
   */
  const placed = replacements.map(function toPlaced(replacement,): PlacedReplacement {
    /**
     * Span this replacement names.
     */
    const span = spans.get(replacement.chunkIndex,);
    if (span === undefined) {
      throw new Error(
        `no slice ${String(replacement.chunkIndex,)} to write into: `
        + `the document was sliced into ${String(slices.length,)} slices`,
      );
    }
    return {
      replacement,
      span,
    };
  },);
  if (new Set(placed.map(function toIndex(entry,): number {
    return entry.replacement
      .chunkIndex;
  },),).size !== placed.length) {
    throw new Error(
      'two replacements name one slice: whichever applied second would '
      + 'overwrite the other, and the winner would depend on sort order',
    );
  }

  /**
   * Replacements in the order they can be written without moving each other.
   */
  const ordered = placed.toSorted(function byOffsetDescending(
    left,
    right,
  ): number {
    /**
     * Where the left span starts.
     */
    const leftOffset = left.span
      .startOffset;

    /**
     * Where the right one starts.
     */
    const rightOffset = right.span
      .startOffset;

    /**
     * Offset gap, which decides every pair of distinct spans.
     */
    const byOffset = rightOffset - leftOffset;
    if (byOffset !== 0)
      return byOffset;

    /**
     * Left slice, for the tie.
     */
    const leftIndex = left.replacement
      .chunkIndex;

    /**
     * Right slice.
     */
    const rightIndex = right.replacement
      .chunkIndex;

    // Same offset means insertions into one empty span. Writing the later
    // slice first leaves the earlier one before it, which is document order.
    return rightIndex - leftIndex;
  },);

  return ordered.reduce(
    function spliceOne(
      text: string,
      entry,
    ): string {
      /**
       * Everything before this span, untouched.
       */
      const head = text.slice(
        0,
        entry.span
          .startOffset,
      );

      /**
       * Text going in, which for a zero-length span is an insertion.
       */
      const written = entry.replacement
        .replacementText;

      /**
       * Everything after it, whose offsets are still valid because writing
       * runs backwards through the document.
       */
      const tail = text.slice(entry.span
        .endOffset,);
      return head
        + written
        + tail;
    },
    targetText,
  );
}

//endregion Slice splicing
