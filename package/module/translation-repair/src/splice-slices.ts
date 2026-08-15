import type {
  ChunkPair,
  DocumentChunk,
} from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import {
  composeInsertion,
  documentLineEnding,
} from './insertion-separator.ts';
import { assertPlacementLayout, } from './placement-layout.ts';
import { assertSliceIndexing, } from './slice-indexing.ts';

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

  /**
   * Original this slice renders, which decides whether blank text may be
   * written into a place that has nothing yet.
   */
  readonly sourceText: string;
};

/**
 * One write assembly performs, which is not one replacement.
 *
 * Several anchors can share a boundary, and their separators are decided once
 * for the whole group rather than by each in turn, so the group is ONE edit.
 *
 * @example
 * ```ts
 * const edit: SpliceEdit = { kind: 'insertion', startOffset: 12, endOffset: 12, orderIndex: 3, fragments, };
 * ```
 */
type SpliceEdit = {
  /**
   * Whether this writes over existing text or into a place where none is.
   */
  readonly kind: 'content';

  /**
   * Where the span being written over starts.
   */
  readonly startOffset: number;

  /**
   * Where it ends, exclusive.
   */
  readonly endOffset: number;

  /**
   * Slice this edit is ordered by, which for a group is its earliest.
   */
  readonly orderIndex: number;

  /**
   * Text to write, exactly as its lane produced it.
   */
  readonly text: string;
} | {
  /**
   * Whether this writes over existing text or into a place where none is.
   */
  readonly kind: 'insertion';

  /**
   * Boundary the anchors share.
   */
  readonly startOffset: number;

  /**
   * Same boundary, since an anchor covers nothing.
   */
  readonly endOffset: number;

  /**
   * Earliest slice anchored here, which orders this group against the rest.
   */
  readonly orderIndex: number;

  /**
   * What the lanes produced for those slices, in document order.
   */
  readonly fragments: readonly string[];
};

/**
 * Plans every write, in the order they can be made without moving each other.
 *
 * DESCENDING, so writing one never shifts the offsets of those still pending.
 * At one boundary the later slice is written first, which leaves the earlier
 * one ahead of it: document order, and true only because an index IS a
 * position, which {@link spliceSlices} asserts before this runs.
 *
 * @param placed - replacements joined to the spans they name
 *
 * @returns Edits in application order
 *
 * @throws {@link Error} when a boundary group holds nothing, which grouping
 * cannot produce
 *
 * @example
 * ```ts
 * const edits = plannedEdits({ placed, },);
 * ```
 */
function plannedEdits(
  { placed, }: { readonly placed: readonly PlacedReplacement[]; },
): readonly SpliceEdit[] {
  /**
   * Writes over existing text, one per replacement.
   */
  const overText = placed
    .filter(function coversText(entry,): boolean {
      return !isInsertionChunk(entry.span,);
    },)
    .map(function toContentEdit(entry,): SpliceEdit {
      return {
        kind: 'content',
        startOffset: entry.span
          .startOffset,
        endOffset: entry.span
          .endOffset,
        orderIndex: entry.replacement
          .chunkIndex,
        text: entry.replacement
          .replacementText,
      };
    },);

  /**
   * Writes into a place, gathered by the boundary they share.
   */
  const byBoundary = Map.groupBy(
    placed.filter(function namesAPlace(entry,): boolean {
      return isInsertionChunk(entry.span,);
    },),
    function toBoundary(entry,): number {
      return entry.span
        .startOffset;
    },
  );

  /**
   * One edit per boundary, carrying its fragments in document order.
   */
  const intoPlaces = [...byBoundary,].map(function toInsertionEdit(entry,): SpliceEdit {
    /**
     * Boundary and the replacements anchored there.
     */
    const [offset, group,] = entry;

    /**
     * Those replacements in document order, which is slice order.
     */
    const inOrder = group.toSorted(function byIndex(
      left,
      right,
    ): number {
      /**
       * Slice the left replacement names.
       */
      const leftIndex = left.replacement
        .chunkIndex;

      /**
       * Slice the right one names.
       */
      const rightIndex = right.replacement
        .chunkIndex;
      return leftIndex - rightIndex;
    },);

    /**
     * Earliest of them, which orders the whole group.
     */
    const [first,] = inOrder;
    if (first === undefined)
      throw new Error('unreachable: grouping produced a boundary with no replacement',);
    return {
      kind: 'insertion',
      startOffset: offset,
      endOffset: offset,
      orderIndex: first.replacement
        .chunkIndex,
      fragments: inOrder.map(function toText(anchored,): string {
        return anchored.replacement
          .replacementText;
      },),
    };
  },);
  return [
    ...overText,
    ...intoPlaces,
  ].toSorted(function byOffsetDescending(
    left,
    right,
  ): number {
    /**
     * Offset gap, which decides every pair of distinct boundaries.
     */
    const byOffset = right.startOffset - left.startOffset;
    if (byOffset !== 0)
      return byOffset;
    return right.orderIndex - left.orderIndex;
  },);
}

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
      slice,
    ] as const;
  },),);
  if (spans.size !== slices.length) {
    throw new Error(
      'two slices carry one index: a map keyed by index keeps only the last of '
        + 'them, so one slice becomes unreachable while its replacement lands '
        + 'on the other',
    );
  }

  // AFTER identity, BEFORE any offset is read. Assembly is where a malformed
  // span does its damage, because slicing a string clamps: a span running
  // past the end, or backwards, produces plausible text rather than a
  // failure. Identity comes first because a list that names one slice twice
  // is a caller disagreeing with the slicer, which explains every offset
  // complaint that would follow it.
  // POSITIONAL INDICES, which the sort below depends on and this function
  // cannot otherwise assume. Two anchors at one boundary are written in
  // descending index order so they land in ascending order, which is document
  // order only while an index IS a position. A caller handing in slices whose
  // indices are unique but shuffled gets a document with its insertions
  // reversed and no complaint from anything else here.
  assertSliceIndexing({ slices, },);
  assertPlacementLayout({
    slices,
    targetText,
  },);

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
    const slice = spans.get(replacement.chunkIndex,);
    if (slice === undefined) {
      throw new Error(
        `no slice ${String(replacement.chunkIndex,)} to write into: `
        + `the document was sliced into ${String(slices.length,)} slices`,
      );
    }

    /**
     * Where it goes.
     */
    const span = slice.target;

    /**
     * Whether this is a place rather than existing wording.
     */
    const missingTranslation = isInsertionChunk(span,);

    /**
     * Original this slice renders.
     */
    const sourceText = slice.source
      .text;
    /**
     * Whether the text offered for this slice says nothing.
     */
    const writesNothing = replacement.replacementText
      .trim()
      === '';

    /**
     * Whether the original says something.
     */
    const sourceSaysSomething = sourceText.trim() !== '';
    if (missingTranslation
      && writesNothing
      && sourceSaysSomething) {
      throw new Error(
        `slice ${String(replacement.chunkIndex,)} has no translation and writes none: an anchor is `
          + 'where a rendering belongs, so blank text there leaves the passage missing while the run '
          + 'reports it delivered',
      );
    }
    return {
      replacement,
      span,
      sourceText,
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
   * Every edit this call makes, with the anchors sharing one boundary gathered
   * into a single one.
   *
   * GATHERED RATHER THAN SEQUENCED, because the separators between them are
   * decided once for the whole group: written one at a time, each would have to
   * guess what the others had already put there.
   */
  const edits = plannedEdits({ placed, },);

  /**
   * Line ending this document separates its blocks with.
   */
  const eol = documentLineEnding({ targetText, },);

  return edits.reduce(
    function spliceOne(
      text: string,
      edit,
    ): string {
      /**
       * Everything before this edit, which no earlier write has touched: edits
       * run backwards through the document, so the prefix is still the archive.
       */
      const head = text.slice(
        0,
        edit.startOffset,
      );

      /**
       * Everything after it, as it will stand: later offsets were written
       * first, so this is what the edit's text will actually meet.
       */
      const tail = text.slice(edit.endOffset,);

      /**
       * Text going in. A content span carries its lane's text verbatim, which
       * is what every replacement did before anchors existed. An anchor has no
       * span to sit between, so assembly composes its separators.
       */
      const written = (edit.kind === 'insertion')
        ? composeInsertion({
          fragments: edit.fragments,
          before: head,
          after: tail,
          eol,
        },)
        : edit.text;
      return head
        + written
        + tail;
    },
    targetText,
  );
}

//endregion Slice splicing
