import type { RosterModelId, } from './synthetic-catalog.ts';

//region Bench seating
// THE BENCH A PER-ITEM HOOK HANDS A PHASE THAT ASKS ONE BENCH (ledger X12):
// the lane contest's judges, the insertion admission's roster and the
// preparation's roster. Phases asking several benches at once hand a roster
// of their own shape (`ConsolidateSliceSeating`, `RepairSliceSeating`,
// `TranslateSliceSeating`, `PictureReaderSeating`).

/**
 What a per-item hook hands a phase that asks one bench.

 @example
 ```ts
 const seating: BenchSeating = { modelIds: seats.lateJudges, };
 ```
 */
export type BenchSeating = {
  /**
   Bench read since the phase started, absent while the given one stands.
   */
  readonly modelIds?: readonly RosterModelId[];
};

//endregion Bench seating
