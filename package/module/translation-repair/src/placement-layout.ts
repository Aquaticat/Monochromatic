import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';

//region Placement layout
// Whether a preparation's target spans can be written back into the document
// they were cut from.
//
// SEPARATE FROM INDEXING, which `slice-indexing.ts` covers. That file proves a
// slice is CALLED what its position says; this one proves the slice POINTS
// somewhere sane. Both were the same statement while every span came from a
// disjoint run of nodes, and `#100` separates them: an insertion anchor covers
// no nodes at all, so nothing about its offsets follows from how it was carved.
//
// ONE ORDERING RULE COVERS THE WHOLE LIST the review asked for. Every span
// starts at or after the previous span's END, and from that single statement
// follow: non-empty spans never overlap; an insertion never lands strictly
// inside a span; two non-empty spans never start at one offset; an insertion
// never sits after a span it shares a boundary with; and no placement moves
// backwards. What it still ALLOWS is every legal shape: several insertions at
// one boundary, an insertion at a span's start meaning before it, an insertion
// at a span's end, and adjacent spans that touch.
//
// WHY IT MATTERS MORE THAN IT LOOKS: `String.prototype.slice` clamps. A span
// running past the end of the document, or backwards, produces plausible text
// rather than a diagnostic, and assembly then ships a document nobody can tell
// is wrong from the output alone.

/**
 * Thrown when target spans cannot be written back into their document.
 *
 * @example
 * ```ts
 * throw new PlacementLayoutError({ message: 'slice 3 starts before slice 2 ends', },);
 * ```
 */
export class PlacementLayoutError extends Error {
  /**
   * Builds failure naming what cannot be placed.
   *
   * @param message - what is wrong, in slice and offset terms
   *
   * @example
   * ```ts
   * throw new PlacementLayoutError({ message: 'slice 3 runs past the document', },);
   * ```
   */
  public constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'PlacementLayoutError';
  }
}

/**
 * Refuses one slice whose own span is malformed, whatever its neighbours do.
 *
 * @param slice - prepared pair whose target side is checked
 *
 * @param position - where it sits, for the message
 *
 * @param targetText - document the span indexes into
 *
 * @throws {@link PlacementLayoutError} when offsets are not whole numbers in
 * order and in range, when a span's text is not what the document holds there,
 * or when an insertion covers anything at all
 *
 * @example
 * ```ts
 * assertSpanShape({ slice, position: 0, targetText, },);
 * ```
 */
function assertSpanShape(
  {
    slice,
    position,
    targetText,
  }: {
    readonly slice: ChunkPair;
    readonly position: number;
    readonly targetText: string;
  },
): void {
  /**
   * Target side, which is the only side assembly writes into.
   */
  const span = slice.target;

  /**
   * Where it starts.
   */
  const { startOffset, } = span;

  /**
   * Where it ends, exclusive.
   */
  const { endOffset, } = span;
  if ((!Number.isInteger(startOffset,)) || (!Number.isInteger(endOffset,))) {
    throw new PlacementLayoutError({
      message: `slice at position ${String(position,)} carries offsets ${
        String(startOffset,)
      } and ${String(endOffset,)}, which are not both whole numbers`,
    },);
  }
  /**
   * How much document there is to point into.
   */
  const documentLength = targetText.length;
  if ((startOffset < 0)
    || (endOffset > documentLength)) {
    throw new PlacementLayoutError({
      message: `slice at position ${String(position,)} spans ${String(startOffset,)} to ${
        String(endOffset,)
      } in a document of ${String(documentLength,)}, and slicing a string CLAMPS rather than fails`,
    },);
  }
  if (startOffset > endOffset) {
    throw new PlacementLayoutError({
      message: `slice at position ${String(position,)} ends at ${String(endOffset,)} before it starts at ${
        String(startOffset,)
      }, which slicing reads as an empty span rather than as the mistake it is`,
    },);
  }
  if (span.text !== targetText.slice(
    startOffset,
    endOffset,
  )) {
    throw new PlacementLayoutError({
      message: `slice at position ${String(position,)} carries text the document does not hold between ${
        String(startOffset,)
      } and ${String(endOffset,)}, so these slices were cut from another document`,
    },);
  }
  if (isInsertionChunk(span,)) {
    /**
     * How many nodes it claims, which for a place is none.
     */
    const nodeCount = span.nodes
      .length;

    /**
     * Whether it covers a range or wording, either of which contradicts it.
     */
    const covers = (startOffset !== endOffset)
      || (span.text !== '');
    if (covers
      || (nodeCount > 0)) {
      throw new PlacementLayoutError({
        message: `slice at position ${String(position,)} says it is an insertion and covers text anyway`,
      },);
    }
    return;
  }
  if (startOffset === endOffset) {
    throw new PlacementLayoutError({
      message: `slice at position ${String(position,)} is content covering nothing at ${
        String(startOffset,)
      }; an empty span is an insertion, and saying so is what tells assembly to write INTO it`,
    },);
  }
}

/**
 * Refuses a preparation whose target spans cannot all be written back.
 *
 * WALKS IN SLICE ORDER rather than in offset order, because slice order is what
 * a caller relies on: it decides which of two insertions at one boundary comes
 * first, and it is the order every lane result and every ledger is read in. A
 * preparation whose spans are sorted differently from its slices is exactly the
 * defect this exists to name.
 *
 * @param slices - prepared slice pairs in document order
 *
 * @param targetText - translation those spans index into
 *
 * @throws {@link PlacementLayoutError} when a span is malformed, or when one
 * does not start at or after the previous span's end
 *
 * @example
 * ```ts
 * assertPlacementLayout({ slices, targetText, },);
 * ```
 */
export function assertPlacementLayout(
  {
    slices,
    targetText,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly targetText: string;
  },
): void {
  for (const [position, slice,] of slices.entries()) {
    assertSpanShape({
      slice,
      position,
      targetText,
    },);

    /**
     * Slice before this one, absent for the first.
     */
    const previous = (position === 0) ? undefined : slices[position - 1];
    if (previous === undefined)
      continue;

    /**
     * Where the previous span ends, which this one may start at.
     */
    const boundary = previous.target
      .endOffset;

    /**
     * Where this span starts.
     */
    const { startOffset, } = slice.target;
    if (startOffset < boundary) {
      throw new PlacementLayoutError({
        message: `slice at position ${String(position,)} starts at ${String(startOffset,)} while the `
          + `slice before it runs to ${String(boundary,)}, so writing one would move or overwrite the `
          + 'other',
      },);
    }
  }
}

//endregion Placement layout
