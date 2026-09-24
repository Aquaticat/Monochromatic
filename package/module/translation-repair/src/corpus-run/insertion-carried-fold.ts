import type { ChunkPair, } from '../chunk-document.ts';
import {
  type ContentChunk,
  isInsertionChunk,
} from '../chunk-placement.ts';
import type {
  CarriedInsertion,
  FoldedInsertion,
  InsertionAdmission,
} from '../insertion-admission.ts';
import { locateQuote, } from '../locate-quote.ts';
import { parseDocument, } from '../parse-document.ts';
import type { PreparedDocumentPair, } from '../prepared-document-pair.ts';
import type { AnchorTarget, } from '../validate-issue.ts';

//region Carried insertion fold
// THE PASSAGE BELONGS WITH ITS RENDERING. A carried insertion is a source-only
// slice whose English the roster found already on the page; where that
// English sits inside the archive span the pairing gave the NEIGHBOURING
// slice, the archive merged two originals into one rendering and the pairing
// left one of them unpaired. The lanes then write the neighbour from its own
// source alone: on mikaela12 (2026-09-24) the translate lane's judges rightly
// preferred the candidate without "the surrounding passage", the contest took
// it, and the guard at publish stopped the entry with the carried sentence
// gone (class one hundred ten). Folding the carried source into the carrier
// makes the pair honest, so both lanes render the passage as part of the
// slice that carries it; the folded slice stays an insertion the lanes skip,
// and leaves the guard, whose evidence the lanes may now reword.
//
// ONLY THE UNAMBIGUOUS CASE FOLDS: every evidence region inside one paired
// slice's span, that slice the next or previous in prepared order, and
// nothing but blank space between the two sources. Anything else stays
// carried exactly as before.

/**
 Finding prefix for a passage folded into its carrier.
 */
export const CARRIED_FOLDED_FINDING = 'insertion-carried-folded';

/**
 Slices and records as the folds so far left them.
 */
type FoldState = {
  /**
   Slices with every carrier folded so far widened.
   */
  readonly slices: readonly ChunkPair[];

  /**
   Passages still carried, in admission order.
   */
  readonly kept: readonly CarriedInsertion[];

  /**
   Passages folded into a carrier.
   */
  readonly folded: readonly FoldedInsertion[];

  /**
   One finding per fold.
   */
  readonly findings: readonly string[];
};

/**
 One carried passage's fold decision.
 */
type FoldDecision =
  | {
    readonly kind: 'fold';
    readonly carrierPosition: number;
  }
  | {
    readonly kind: 'aside';
  };

/**
 Positions of paired slices whose target span holds the whole region.

 @param slices - prepared slices

 @param startOffset - region start in the target

 @param endOffset - region end in the target

 @returns Every holding position, in prepared order

 @example
 ```ts
 const holders = holdingPositions({ slices, startOffset: 10, endOffset: 40, },);
 ```
 */
function holdingPositions(
  {
    slices,
    startOffset,
    endOffset,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly startOffset: number;
    readonly endOffset: number;
  },
): readonly number[] {
  return slices.flatMap(function holding(
    slice,
    position,
  ): readonly number[] {
    /**
     Placement on the target side.
     */
    const { target, } = slice;
    if (isInsertionChunk(target,))
      return [];
    return ((target.startOffset <= startOffset) && (endOffset <= target.endOffset))
      ? [position,]
      : [];
  },);
}

/**
 Positions of paired slices holding one anchored region of the page.

 @param slices - prepared slices

 @param target - archive parsed for anchoring

 @param region - page text a voice quoted

 @returns Holding positions, none where the region anchors nowhere

 @example
 ```ts
 const holders = regionHolders({ slices, target, region: 'The cat slept.', },);
 ```
 */
function regionHolders(
  {
    slices,
    target,
    region,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly target: AnchorTarget;
    readonly region: string;
  },
): readonly number[] {
  /**
   Where the region sits on the page.
   */
  const location = locateQuote({
    document: target,
    side: 'target',
    quote: region,
  },);
  if (!location.located)
    return [];
  /**
   Starts of every anchor.
   */
  const starts = location.anchors
    .map(function start(anchor,): number {
      return anchor.startOffset;
    },);
  /**
   Ends of every anchor.
   */
  const ends = location.anchors
    .map(function end(anchor,): number {
      return anchor.endOffset;
    },);
  return holdingPositions({
    slices,
    startOffset: Math.min(...starts,),
    endOffset: Math.max(...ends,),
  },);
}

/**
 Whether the original writes nothing but blank space between two spans.

 @param sourceText - whole original

 @param first - earlier source chunk

 @param second - later source chunk

 @returns True where the spans abut across blank space alone

 @example
 ```ts
 const touching = abutting({ sourceText, first: a.source, second: b.source, },);
 ```
 */
function abutting(
  {
    sourceText,
    first,
    second,
  }: {
    readonly sourceText: string;
    readonly first: ContentChunk;
    readonly second: ContentChunk;
  },
): boolean {
  if (second.startOffset < first.endOffset)
    return false;
  /**
   What the original writes between the two spans.
   */
  const between = sourceText.slice(
    first.endOffset,
    second.startOffset,
  );
  return between.trim() === '';
}

/**
 Decides whether one carried passage folds into a neighbour.

 @param slices - prepared slices as they stand

 @param sourceText - whole original

 @param target - archive parsed for anchoring

 @param candidate - carried passage under decision

 @returns Fold into the carrier, or standing aside

 @example
 ```ts
 const decision = decideFold({ slices, sourceText, target, candidate, },);
 ```
 */
function decideFold(
  {
    slices,
    sourceText,
    target,
    candidate,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sourceText: string;
    readonly target: AnchorTarget;
    readonly candidate: CarriedInsertion;
  },
): FoldDecision {
  /**
   Distinct regions the voices anchored.
   */
  const regions = [...new Set(candidate.evidence,),];
  if (regions.length === 0)
    return { kind: 'aside', };
  /**
   Holders of every region, one list per region.
   */
  const holdersPerRegion = regions.map(function holdersOf(region,): readonly number[] {
    return regionHolders({
      slices,
      target,
      region,
    },);
  },);
  /**
   Positions holding every region.
   */
  const holders = holdersPerRegion.reduce(function intersect(
    kept,
    next,
  ): readonly number[] {
    return kept.filter(function inNext(position,): boolean {
      return next.includes(position,);
    },);
  },);
  if (holders.length !== 1)
    return { kind: 'aside', };
  /**
   The one slice holding the evidence.
   */
  const carrierPosition = holders[0] ?? (-1);
  if (Math.abs(carrierPosition - candidate.position,) !== 1)
    return { kind: 'aside', };
  /**
   The carried slice as prepared.
   */
  const carriedSlice = slices[candidate.position];
  /**
   The carrier as prepared.
   */
  const carrier = slices[carrierPosition];
  if ((carriedSlice === undefined) || (carrier === undefined))
    return { kind: 'aside', };
  /**
   Stable index the carried slice reports under.
   */
  const carriedSliceIndex = carriedSlice.target
    .sliceIndex;
  if ((!isInsertionChunk(carriedSlice.target,)) || (carriedSliceIndex !== candidate.sliceIndex))
    return { kind: 'aside', };
  /**
   Whether the two sources abut across blank space alone, in either order.
   */
  const touching = (carrierPosition < candidate.position)
    ? abutting({
      sourceText,
      first: carrier.source,
      second: carriedSlice.source,
    },)
    : abutting({
      sourceText,
      first: carriedSlice.source,
      second: carrier.source,
    },);
  if (!touching)
    return { kind: 'aside', };
  return {
    kind: 'fold',
    carrierPosition,
  };
}

/**
 The carrier's source widened over the carried passage.

 @param sourceText - whole original

 @param carrier - carrier slice

 @param carried - carried slice

 @returns Carrier with its source covering both spans, in document order

 @example
 ```ts
 const widened = widenCarrier({ sourceText, carrier, carried, },);
 ```
 */
function widenCarrier(
  {
    sourceText,
    carrier,
    carried,
  }: {
    readonly sourceText: string;
    readonly carrier: ChunkPair;
    readonly carried: ChunkPair;
  },
): ChunkPair {
  /**
   Both sources, earlier first.
   */
  const ordered = [
    carrier.source,
    carried.source,
  ]
    .toSorted(function byStart(
      a,
      b,
    ): number {
      return a.startOffset - b.startOffset;
    },);
  /**
   Starts of both spans.
   */
  const starts = ordered.map(function start(chunk,): number {
    return chunk.startOffset;
  },);
  /**
   Ends of both spans.
   */
  const ends = ordered.map(function end(chunk,): number {
    return chunk.endOffset;
  },);
  /**
   Where the widened span starts.
   */
  const startOffset = Math.min(...starts,);
  /**
   Where it ends.
   */
  const endOffset = Math.max(...ends,);
  /**
   Stable index the carrier's source reports under.
   */
  const carrierSourceIndex = carrier.source
    .sliceIndex;
  /**
   The widened source.
   */
  const source: ContentChunk = {
    kind: 'content',
    sliceIndex: carrierSourceIndex,
    nodes: ordered.flatMap(function nodesOf(chunk,): ContentChunk['nodes'] {
      return chunk.nodes;
    },),
    startOffset,
    endOffset,
    text: sourceText.slice(
      startOffset,
      endOffset,
    ),
  };
  return {
    ...carrier,
    source,
  };
}

/**
 Folds every unambiguously placed carried passage into its carrier.

 @param prepared - preparation both lanes run over

 @param admission - insertion admission as read

 @returns Preparation with carriers widened, the admission with folded
 passages moved out of `carried`, and one finding per fold

 @example
 ```ts
 const folded = foldCarriedInsertions({ prepared, admission, },);
 ```
 */
export function foldCarriedInsertions(
  {
    prepared,
    admission,
  }: {
    readonly prepared: PreparedDocumentPair;
    readonly admission: InsertionAdmission;
  },
): {
  readonly prepared: PreparedDocumentPair;
  readonly admission: InsertionAdmission;
  readonly findings: readonly string[];
} {
  /**
   Passages the roster found carried.
   */
  const carried = admission.carried ?? [];
  if (carried.length === 0) {
    return {
      prepared,
      admission,
      findings: [],
    };
  }
  /**
   Archive parsed once for every region's anchoring.
   */
  const target = parseDocument({ text: prepared.targetText, },);
  /**
   Every passage folded in turn over the slices the earlier folds left, so
   two passages folding into one carrier both widen it.
   */
  const outcome = carried.reduce(
    function foldOne(
      state: FoldState,
      candidate,
    ): FoldState {
      /**
       Whether and where this passage folds.
       */
      const decision = decideFold({
        slices: state.slices,
        sourceText: prepared.sourceText,
        target,
        candidate,
      },);
      /**
       The carrier as the earlier folds left it, absent on a stand-aside.
       */
      const carrier = (decision.kind === 'fold') ? state.slices[decision.carrierPosition] : undefined;
      /**
       The carried slice.
       */
      const carriedSlice = state.slices[candidate.position];
      /**
       Whether nothing folds: the decision stood aside or a slice is missing.
       */
      const standsAside = (decision.kind === 'aside')
        || (carrier === undefined)
        || (carriedSlice === undefined);
      if (standsAside) {
        return {
          slices: state.slices,
          kept: [
            ...state.kept,
            candidate,
          ],
          folded: state.folded,
          findings: state.findings,
        };
      }
      /**
       Carrier over both sources.
       */
      const widened = widenCarrier({
        sourceText: prepared.sourceText,
        carrier,
        carried: carriedSlice,
      },);
      /**
       Stable index the lanes report the carrier under.
       */
      const carrierSliceIndex = carrier.target
        .sliceIndex;
      return {
        slices: state.slices
          .map(function replaceCarrier(
            slice,
            position,
          ): ChunkPair {
            return (position === decision.carrierPosition) ? widened : slice;
          },),
        kept: state.kept,
        folded: [
          ...state.folded,
          {
            position: candidate.position,
            sliceIndex: candidate.sliceIndex,
            carrierSliceIndex,
          },
        ],
        findings: [
          ...state.findings,
          `${CARRIED_FOLDED_FINDING} (slice ${String(candidate.sliceIndex,)} into slice ${
            String(carrierSliceIndex,)
          })`,
        ],
      };
    },
    {
      slices: prepared.slices,
      kept: [],
      folded: [],
      findings: [],
    },
  );
  return {
    prepared: {
      ...prepared,
      slices: outcome.slices,
    },
    admission: {
      ...admission,
      carried: outcome.kept,
      folded: outcome.folded,
      findings: [
        ...admission.findings,
        ...outcome.findings,
      ],
    },
    findings: outcome.findings,
  };
}

//endregion Carried insertion fold
