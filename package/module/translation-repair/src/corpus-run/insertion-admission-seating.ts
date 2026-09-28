import type { RosterModelId, } from '../synthetic-catalog.ts';

//region Insertion admission seating
// THE ROSTER A PER-CANDIDATE HOOK HANDS THE INSERTION ADMISSION (ledger X12),
// as the other phases' hooks hand their items a bench. The coverage question
// asks one roster, so the seating is that roster.

/**
 What a per-candidate hook hands the insertion admission.

 @example
 ```ts
 const seating: CoverageSeating = { modelIds: seats.roster, };
 ```
 */
export type CoverageSeating = {
  /**
   Roster read since the admission started, absent while the given one stands.
   */
  readonly modelIds?: readonly RosterModelId[];
};

//endregion Insertion admission seating
