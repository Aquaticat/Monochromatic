import type { AlignmentStep, } from './align-blocks-walk.ts';
import type { DocumentNode, } from './document-node.ts';

//region Source anchor offsets
// Where a block the translation never rendered would be written, read off the
// monotone walk.
//
// WHY THE WALK CAN ANSWER THIS AND THE HEADING ALIGNER COULD NOT. The heading
// aligner reports one decision per source row and then every unclaimed target
// row, so it carries no cursor and its skip position had to be recovered from
// the table (`align-headings-optimal.ts`). This walk is monotone by
// construction: its steps ARE the cursor, in document order, so the place a
// source block is skipped at is simply where it sits in the sequence.
//
// A MERGE IS NOT AN OMISSION, and the walk already separates them. Two originals
// rendered as one translation block arrive as a `paired` step followed by a
// `source-only` step carrying `continuesPairing`, and that second original IS
// placed, against a block the first already claimed. Only a `source-only` step
// WITHOUT that marker is an original nothing rendered. This is the same
// predicate `declined-target-runs.ts` uses to decide whether a pairing left an
// original unplaced, kept identical on purpose: two readings of "unplaced" that
// drifted apart would disagree about the same document.

/**
 * Stands for "no offset here", which is not an offset any document has: every
 * real one is zero or greater.
 */
const NO_OFFSET = -1;

/**
 * Offsets a walk step covers on the translation side.
 */
type RenderedSpan = {
  /**
   * Where the block begins, or {@link NO_OFFSET} when the step consumes none.
   */
  readonly start: number;

  /**
   * Where it ends, under the same convention.
   */
  readonly end: number;
};

/**
 * Reads the span of the translation block a step consumes.
 *
 * RETURNS SENTINELS RATHER THAN AN ABSENT NODE, so callers compare numbers
 * instead of narrowing, and a step naming only an original reads the same way
 * as a position past the end of the walk.
 *
 * @param step - one walk step
 *
 * @param targetNodes - translation blocks the steps index
 *
 * @returns Start and end offsets, both {@link NO_OFFSET} when the step consumes
 * no translation block
 *
 * @example
 * ```ts
 * const span = renderedSpan({ step, targetNodes, },);
 * ```
 */
function renderedSpan(
  {
    step,
    targetNodes,
  }: {
    readonly step: AlignmentStep;
    readonly targetNodes: readonly DocumentNode[];
  },
): RenderedSpan {
  /**
   * Block this step consumes, absent when it names only an original or indexes
   * past the sequence.
   */
  const node = (step.kind === 'source-only')
    ? undefined
    : targetNodes[step.targetIndex];

  if (node === undefined)
    return {
      start: NO_OFFSET,
      end: NO_OFFSET,
    };

  return {
    start: node.startOffset,
    end: node.endOffset,
  };
}

/**
 * Reports whether a step names an original block nothing rendered.
 *
 * @param step - one walk step
 *
 * @returns Whether it leaves that original unplaced
 *
 * @example
 * ```ts
 * const unplaced = leavesOriginalUnplaced(step,);
 * ```
 */
export function leavesOriginalUnplaced(step: AlignmentStep,): boolean {
  return (step.kind === 'source-only') && (step.continuesPairing !== true);
}

/**
 * Reads where each unplaced original block's translation would be written.
 *
 * ANCHORED BEFORE THE NEXT RENDERED BLOCK, or after the last one when nothing
 * follows. Anchoring after the PREVIOUS block instead would be the same place
 * in a document with no gap between blocks and a different one wherever the
 * translation carries anything between them, so the two are not
 * interchangeable and the forward reading is the one that keeps the insertion
 * outside a rendering rather than inside it.
 *
 * A WALK THAT CONSUMES NO TRANSLATION BLOCK AT ALL yields no anchors. That is a
 * section whose translation is empty, which needs a body-insertion boundary
 * rather than a block one, and inventing offset zero for it would write into
 * whatever the section actually begins with.
 *
 * @param walk - monotone steps in document order
 *
 * @param targetNodes - translation blocks the steps index
 *
 * @returns Walk position of each unplaced original, mapped to the offset its
 * rendering would be written at
 *
 * @example
 * ```ts
 * const anchors = anchorOffsets({ walk, targetNodes, },);
 * ```
 */
export function anchorOffsets(
  {
    walk,
    targetNodes,
  }: {
    readonly walk: readonly AlignmentStep[];
    readonly targetNodes: readonly DocumentNode[];
  },
): ReadonlyMap<number, number> {
  // A PAIRING THAT PLACED NOTHING DOES NOT MAKE EVERY ORIGINAL ABSENT. With no
  // paired step anywhere, every original reads as unplaced and every
  // translation block as unclaimed, which is a pairing that failed rather than a
  // page missing its whole source. Reading it as absence would propose writing
  // the entire original into a page that already carries a translation of it,
  // and would leave the unclaimed translation blocks with no run to belong to.
  //
  // `declined-target-runs.ts` refuses the mirror of this for the same reason:
  // "Nor does a pairing that placed nothing at all decline everything."
  if (!walk.some(function placesSomething(step,): boolean {
    return step.kind === 'paired';
  },))
    return new Map<number, number>();

  /**
   * Offset the next rendered block begins at, per walk position, using
   * {@link NO_OFFSET} where no rendered block follows.
   *
   * Filled by scanning BACKWARDS so each position reads the answer the position
   * after it already computed, which makes the whole pass linear.
   */
  const nextOffsets: number[] = Array.from(
    { length: walk.length, },
    function unknown(): number {
      return NO_OFFSET;
    },
  );

  /**
   * Offset carried backwards through the scan.
   */
  const scan = { next: NO_OFFSET, };
  for (let at = walk.length - 1; at >= 0; at -= 1) {
    /**
     * Step at this position, always present since the loop counts down from
     * the walk's own length.
     */
    const step = walk[at];

    /**
     * Span the step consumes on the translation side.
     */
    const span = (step === undefined)
      ? {
        start: NO_OFFSET,
        end: NO_OFFSET,
      }
      : renderedSpan({
        step,
        targetNodes,
      },);
    if (span.start !== NO_OFFSET)
      scan.next = span.start;

    nextOffsets[at] = scan.next;
  }

  /**
   * End of the last translation block the walk consumes, where a trailing
   * unplaced original belongs, or {@link NO_OFFSET} when the walk consumes none.
   */
  const tail = walk.reduce(
    function lastRendered(
      standing: number,
      step,
    ): number {
      /**
       * Span this step consumes on the translation side.
       */
      const span = renderedSpan({
        step,
        targetNodes,
      },);

      return (span.end === NO_OFFSET) ? standing : span.end;
    },
    NO_OFFSET,
  );

  return new Map(walk.flatMap(function toAnchor(
    step,
    at,
  ): readonly (readonly [
    number,
    number,
  ])[] {
    if (!leavesOriginalUnplaced(step,))
      return [];

    /**
     * Where this original's rendering would go: before the next rendered block
     * when one follows, after the last one otherwise.
     */
    const forward = nextOffsets[at] ?? NO_OFFSET;

    /**
     * That, falling back to the tail for an original past every rendering.
     */
    const offset = (forward === NO_OFFSET) ? tail : forward;

    return (offset === NO_OFFSET)
      ? []
      : [[
        at,
        offset,
      ],];
  },),);
}

//endregion Source anchor offsets
