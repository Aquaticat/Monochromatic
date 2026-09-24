import type { ChunkPair, } from '../chunk-document.ts';
import type { ContentChunk, } from '../chunk-placement.ts';
import type {
  CarriedInsertion,
  FoldedInsertion,
  InsertionAdmission,
} from '../insertion-admission.ts';
import { parseDocument, } from '../parse-document.ts';
import type { PreparedDocumentPair, } from '../prepared-document-pair.ts';
import { decideFold, } from './insertion-carried-decide.ts';

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
// THE EVIDENCE MAY RUN INTO BOTH NEIGHBOURS. On mikaela13 (2026-09-24) the
// archive rendered the carried passage across the two paired slices around
// it (the HRT sentences inside the earlier span, "originally just a typical
// thing" as the later span's own line), the one ballot quoted both, and a
// fold that wanted one holder stood aside while the class one hundred seven
// stand-ins on both neighbours dropped the passage (class one hundred
// eleven). So the fold places the evidence block by block: every block must
// sit in a paired slice next to the carried one, and the carrier is the
// neighbour holding the larger share of the quoted text (the earlier on a
// tie), whose source must abut the carried source across blank space alone.
// The other neighbour keeps its own source; the words of the passage it
// rendered are the carrier's to write now.
//
// EVERY STAND-ASIDE SAYS WHY, so a log reader can tell a passage the archive
// really scattered from one the fold could not place.

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

  /**
   One line per passage that stayed carried, naming why.
   */
  readonly asides: readonly string[];
};

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
 passages moved out of `carried`, one finding per fold and one line per
 passage that stayed carried, naming why

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
  readonly asides: readonly string[];
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
      asides: [],
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
        /**
         Why it stays carried.
         */
        const reason = (decision.kind === 'aside') ? decision.reason : 'carrier or carried slice missing from the slicing';
        return {
          slices: state.slices,
          kept: [
            ...state.kept,
            candidate,
          ],
          folded: state.folded,
          findings: state.findings,
          asides: [
            ...state.asides,
            `slice ${String(candidate.sliceIndex,)} stays carried: ${reason}`,
          ],
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
        asides: state.asides,
      };
    },
    {
      slices: prepared.slices,
      kept: [],
      folded: [],
      findings: [],
      asides: [],
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
    asides: outcome.asides,
  };
}

//endregion Carried insertion fold
