import {
  type ArchiveDispute,
  disputedWordingsOf,
} from '../archive-dispute.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import type { DocumentNode, } from '../document-node.ts';
import type { DisputedWording, } from '../disputed-wording.ts';
import type { ArtifactConsolidateSlice, } from './artifact-two-lane-consolidate.ts';
import type { ArtifactContestSlice, } from './artifact-two-lane-contest.ts';
import type { ProjectedLanes, } from './artifact-two-lane-derive.ts';
import type { ConsistencyEnglish, } from '../consistency-wire.ts';
import { wouldShipTextFor, } from './would-ship-text.ts';
import { ConsistencyInvariantError, } from '../consistency-invariant-error.ts';

//region Pass consistency slices
// What the consistency pass reads of each slice: the original, the wording the
// slice would ship at this point, and the facts the floors need. Gathered once,
// so the pass itself works on data and never on the preparation.

/**
 What the pass knows of one slice.

 @example
 ```ts
 const facts: ConsistencySliceFacts = { sliceIndex: 0, sourceIndex: 0, sourceText: '小猫打盹。', sourceStart: 0, nodes: [], current: { kind: 'absent', }, lineStructured: false, disputedWordings: [], };
 ```
 */
export type ConsistencySliceFacts = {
  /**
   Index the comparison row and the artifact name the slice by.
   */
  readonly sliceIndex: number;

  /**
   Index the original's chunk carries, which the repeat groups name.
   */
  readonly sourceIndex: number;

  /**
   The slice's original.
   */
  readonly sourceText: string;

  /**
   Absolute offset in the whole original where the slice starts.
   */
  readonly sourceStart: number;

  /**
   Blocks of the slice's original, whose offsets are absolute.
   */
  readonly nodes: readonly DocumentNode[];

  /**
   The slice's English as it would ship now.
   */
  readonly current: ConsistencyEnglish;

  /**
   Whether the line-structure rule governs the slice.
   */
  readonly lineStructured: boolean;

  /**
   Wordings the slice refuses because its archive rendering was disputed.
   */
  readonly disputedWordings: readonly DisputedWording[];
};

/**
 Gathers what the pass reads of every slice.

 @param prepared - the preparation both lanes ran over

 @param projected - both lanes' rows and the comparison

 @param contestSlices - what the contest decided

 @param consolidateSlices - what the third rendering settled

 @param archiveDisputes - slices whose archive rendering was disputed

 @returns One entry per prepared slice, in order

 @throws {@link UnansweredContestSliceError} when the lanes differ at a slice
 the contest never answered, which the settled page would refuse as well

 @throws {@link Error} when a slice has no comparison row

 @example
 ```ts
 const slices = consistencySlicesOf({ prepared, projected, contestSlices, consolidateSlices, archiveDisputes, },);
 ```
 */
export function consistencySlicesOf(
  {
    prepared,
    projected,
    contestSlices,
    consolidateSlices,
    archiveDisputes,
  }: {
    readonly prepared: PreparedDocumentPair;
    readonly projected: ProjectedLanes;
    readonly contestSlices: readonly ArtifactContestSlice[];
    readonly consolidateSlices: readonly ArtifactConsolidateSlice[];
    readonly archiveDisputes: ReadonlyMap<number, ArchiveDispute>;
  },
): readonly ConsistencySliceFacts[] {
  return prepared.slices
    .map(function factsOf(slice,): ConsistencySliceFacts {
      /**
       Comparison row of the slice.
       */
      const row = projected.comparison
        .find(function namesSlice(candidate,): boolean {
          return candidate.sliceIndex
            === slice.target
            .sliceIndex;
        },);
      if (row === undefined) {
        throw new ConsistencyInvariantError({ invariant:
          `slice ${String(slice.target
            .sliceIndex,)} of the preparation has no comparison row, `
            + 'and the comparison is derived from rows of that preparation', },);
      }
      /**
       What the slice would ship now.
       */
      const reading = wouldShipTextFor({
        artifact: {
          comparison: projected.comparison,
          laneSelection: {
            kind: 'contested',
            slices: contestSlices,
          },
          consolidation: {
            kind: 'settled',
            slices: consolidateSlices,
          },
        },
        row,
      },);
      /**
       Dispute over the slice's archive rendering, absent for most.
       */
      const dispute = archiveDisputes.get(slice.target
        .sliceIndex,);
      return {
        sliceIndex: slice.target
          .sliceIndex,
        sourceIndex: slice.source
          .sliceIndex,
        sourceText: slice.source
          .text,
        sourceStart: slice.source
          .startOffset,
        nodes: slice.source
          .nodes,
        current: (reading.kind === 'wording')
          ? {
            kind: 'present',
            text: reading.text,
          }
          : { kind: 'absent', },
        lineStructured: prepared.lineStructuredSliceIndices
          .has(slice.target
            .sliceIndex,),
        disputedWordings: (dispute === undefined)
          ? []
          : disputedWordingsOf({
            dispute,
            archiveText: row.incumbentText,
          },),
      };
    },);
}

//endregion Pass consistency slices
