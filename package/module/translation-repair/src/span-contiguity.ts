import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import type { DocumentNode, } from './document-node.ts';

//region Span contiguity
// The one thing a span's own text cannot prove: that it covers what it claims to
// cover.
//
// A content chunk carries `nodes`, two offsets and the text between them, and
// the offsets are taken from the FIRST and LAST node of its run. Where a run is
// built by filtering, a document node lying between two of its members but
// absent from it is still inside the resulting range: the text is sliced from
// the offsets, so it contains that node's bytes, and the text-agreement check in
// `placement-layout.ts` passes byte for byte while `nodes` omits a whole block.
//
// WHAT THAT COSTS is silent and total for the omitted block: assembly writes
// over the offset range, so a replacement decided without ever seeing that
// block replaces it anyway. Nothing downstream can notice, because every later
// reader trusts the range.
//
// SO IT IS CHECKED AGAINST THE DOCUMENT rather than against the chunk. The rule
// is that a content chunk's nodes are exactly the document nodes its range
// contains: not a subset chosen by whoever built the run, and not a superset
// reaching outside the offsets.

/**
 * Raised when a span claims a range it does not cover node for node.
 *
 * @example
 * ```ts
 * throw new SpanContiguityError({ message: 'slice 3 covers a block it does not carry', },);
 * ```
 */
export class SpanContiguityError extends Error {
  /**
   * Builds the failure naming the slice and what its range holds.
   *
   * @param message - what the range contains that the nodes do not
   *
   * @example
   * ```ts
   * throw new SpanContiguityError({ message: 'slice 3 covers 3 blocks and carries 2', },);
   * ```
   */
  public constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'SpanContiguityError';
  }
}

/**
 * Counts the document nodes lying inside one half-open range.
 *
 * WHOLLY INSIDE, since a node straddling a boundary is a different fault: the
 * ranges here come from node offsets, so a straddle means the slicing cut a
 * block in half, and the count would hide it either way it were rounded.
 *
 * @param nodes - every node of the document, in order
 *
 * @param startOffset - absolute start of the range
 *
 * @param endOffset - absolute exclusive end
 *
 * @returns Nodes the range contains
 *
 * @example
 * ```ts
 * const covered = nodesInside({ nodes, startOffset, endOffset, },);
 * ```
 */
function nodesInside(
  {
    nodes,
    startOffset,
    endOffset,
  }: {
    readonly nodes: readonly DocumentNode[];
    readonly startOffset: number;
    readonly endOffset: number;
  },
): readonly DocumentNode[] {
  return nodes.filter(function isInside(node,): boolean {
    return (node.startOffset >= startOffset)
      && (node.endOffset <= endOffset);
  },);
}

/**
 * Checks that every content span carries exactly the blocks it covers.
 *
 * CALLED AT PREPARATION, where the document's whole node sequence is in hand.
 * Assembly cannot make this check: it is handed slices and a text, and the text
 * agrees with the offsets whether or not a block went missing from the run.
 *
 * @param slices - prepared slice pairs
 *
 * @param targetNodes - every block-level node of the translation, in order
 *
 * @throws {@link SpanContiguityError} when a span's range holds a block its
 * nodes do not, or its nodes reach outside its range
 *
 * @example
 * ```ts
 * assertSpanContiguity({ slices, targetNodes: targetDocument.nodes, },);
 * ```
 */
export function assertSpanContiguity(
  {
    slices,
    targetNodes,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly targetNodes: readonly DocumentNode[];
  },
): void {
  for (const slice of slices) {
    /**
     * Target side of this pair, which is the side assembly writes over.
     */
    const span = slice.target;
    if (isInsertionChunk(span,))
      continue;

    /**
     * Blocks the document holds inside this span's range.
     */
    const covered = nodesInside({
      nodes: targetNodes,
      startOffset: span.startOffset,
      endOffset: span.endOffset,
    },);

    /**
     * Blocks this slice says it carries.
     */
    const carriedCount = span.nodes
      .length;
    if (covered.length !== carriedCount) {
      throw new SpanContiguityError({
        message: `slice ${String(span.chunkIndex,)} spans ${
          String(covered.length,)
        } blocks of the translation and carries ${String(carriedCount,)}: a block inside the range `
          + 'that the slice never saw is replaced anyway, because assembly writes over the range '
          + 'rather than over the nodes',
      },);
    }

    /**
     * Whether every block the range holds is one this slice carries.
     *
     * Checked by identity rather than by count alone, since a slice carrying a
     * block from OUTSIDE its range plus one fewer from inside would count
     * correctly and describe two different passages.
     */
    const carried = new Set(span.nodes
      .map(function toId(node,): string {
        return node.id;
      },),);
    for (const node of covered) {
      if (!carried.has(node.id,)) {
        throw new SpanContiguityError({
          message: `slice ${String(span.chunkIndex,)} covers block ${
            node.id
          } and does not carry it, so its nodes and its range describe different passages`,
        },);
      }
    }
  }
}

//endregion Span contiguity
