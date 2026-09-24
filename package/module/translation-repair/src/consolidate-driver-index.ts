import type { ArtifactContestSlice, } from './corpus-run/artifact-two-lane-contest.ts';
import type { ProjectedLanes, } from './corpus-run/artifact-two-lane-derive.ts';

//region Consolidation driver index
// The two lookups the consolidation driver reads per slice, built once over
// the whole document: the original of every slice (the repair ledger alone
// carries it) and the contest record of every slice the contest answered.
// Split out of `consolidate-driver.ts` at the line cap (class one hundred
// seven, 2026-09-24).

/**
 Per-slice lookups the driver settles against.

 @example
 ```ts
 const { sourceTexts, contestBySlice, } = indexConsolidationInputs({ projected, contests, },);
 ```
 */
export type ConsolidationIndex = {
  /**
   Original of each slice, keyed by slice index.
   */
  readonly sourceTexts: ReadonlyMap<number, string>;

  /**
   Contest record for each slice it answered, keyed by slice index.
   */
  readonly contestBySlice: ReadonlyMap<number, ArtifactContestSlice>;
};

/**
 Builds the per-slice lookups once for the whole document.

 @param projected - both lane ledgers and comparison

 @param contests - what the contest settled per slice

 @returns Originals and contest records keyed by slice index

 @example
 ```ts
 const index = indexConsolidationInputs({ projected, contests, },);
 ```
 */
export function indexConsolidationInputs(
  {
    projected,
    contests,
  }: {
    readonly projected: ProjectedLanes;
    readonly contests: readonly ArtifactContestSlice[];
  },
): ConsolidationIndex {
  return {
    sourceTexts: new Map(projected.delivery
      .repair
      .map(function nameSource(row,): readonly [
        number,
        string,
      ] {
        return [
          row.sliceIndex,
          row.sourceText,
        ];
      },),),
    contestBySlice: new Map(contests.map(function nameSlice(slice,): readonly [
      number,
      ArtifactContestSlice,
    ] {
      return [
        slice.sliceIndex,
        slice,
      ];
    },),),
  };
}

//endregion Consolidation driver index
