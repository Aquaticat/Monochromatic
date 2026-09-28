import type { RosterModelId, } from './synthetic-catalog.ts';

//region Lane contest slice seating
// THE JUDGES A PER-SLICE HOOK HANDS THE LANE CONTEST (ledger X12), as the
// lanes' hooks hand the repair and translate lanes theirs and the
// consolidation's hook hands it a roster. The contest asks one bench, so its
// seating is that bench.

/**
 What a per-slice hook hands the lane contest.

 @example
 ```ts
 const seating: LaneContestSliceSeating = { modelIds: seats.lateJudges, };
 ```
 */
export type LaneContestSliceSeating = {
  /**
   Judges read since the contest started, absent while the given ones stand.
   */
  readonly modelIds?: readonly RosterModelId[];
};

//endregion Lane contest slice seating
