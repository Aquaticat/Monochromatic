import type { ConsolidationPolishConfig, } from './consolidation-polish.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Consolidation slice seating
// THE ROSTER A PER-SLICE HOOK HANDS THE CONSOLIDATION (ledger H5), as the
// lanes' hooks hand the repair and translate lanes theirs. A roster is handed
// whole: writers, slate judges and the naturalness roles read together, since
// a bench re-read under a hold can seat a polish configuration of its own or
// none, and a field-by-field fallback could not say "none".

/**
 The consolidation's roster for one slice.

 @example
 ```ts
 const roster: ConsolidateRoster = { modelIds, judgeModelIds, };
 ```
 */
export type ConsolidateRoster = {
  /**
   Writers asked for consolidations.
   */
  readonly modelIds: readonly RosterModelId[];
  /**
   Voices that judge each slate and gate its winner.
   */
  readonly judgeModelIds: readonly RosterModelId[];
  /**
   Final naturalness roles and document guard facts, absent where the bench
   configures none.
   */
  readonly polishConfig?: ConsolidationPolishConfig;
};

/**
 What a per-slice hook hands the consolidation.

 @example
 ```ts
 const seating: ConsolidateSliceSeating = { roster, };
 ```
 */
export type ConsolidateSliceSeating = {
  /**
   Roster read since the consolidation started, absent while the given one
   stands.
   */
  readonly roster?: ConsolidateRoster;
};

//endregion Consolidation slice seating
