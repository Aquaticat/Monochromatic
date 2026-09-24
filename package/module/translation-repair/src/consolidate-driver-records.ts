import type { ConsolidationSettlement, } from './consolidate-settle.ts';
import type { ArtifactContestVerdict, } from './corpus-run/artifact-two-lane-contest.ts';
import type { LaneChoice, } from './lane-contest-wire.ts';
import type { TwinStored, } from './twin-memo.ts';

//region Consolidate driver records
// The consolidation driver's small readers, moved out of
// `consolidate-driver.ts` at its line budget: what a fresh purchase leaves a
// twin, and which lane a contest verdict backed.

/**
 Fresh consolidation beside whether it became warm-run evidence.
 
 @example
 ```ts
 const bought: BoughtConsolidation = { settlement, persisted: true, };
 ```
 */
export type BoughtConsolidation = {
  readonly settlement: ConsolidationSettlement;
  readonly persisted: boolean;
};

/**
 Reads cache-eligible record from fresh consolidation.
 
 @param bought - fresh result beside persistence status
 
 @returns Record a twin may reuse, or deliberate nothing
 
 @example
 ```ts
 const stored = storedConsolidationOf({ settlement, persisted: true, },);
 ```
 */
export function storedConsolidationOf(
  bought: BoughtConsolidation,
): TwinStored<ConsolidationSettlement> {
  return bought.persisted
    ? {
      kind: 'stored',
      record: bought.settlement,
    }
    : { kind: 'nothing', };
}

/**
 Reads which lane the contest backed out of the verdict it recorded.
 
 BOTH WAYS OF NOT SETTLING READ AS `neither`, deliberately. The record keeps
 `settled-neither` apart from `quorum-not-met` because they are different
 facts about the run, but this function asks which LANE stood. Neither did.
 `standingTextFor` then uses archive as comparison baseline so consolidation
 can recover, while final-selection guard prevents that unendorsed baseline
 from becoming publication fallback.
 
 @param verdict - what the contest recorded for this slice
 
 @returns Lane the contest backed, or the refusal
 
 @example
 ```ts
 const choice = laneChoiceOf({ verdict, },);
 ```
 */
export function laneChoiceOf(
  { verdict, }: { readonly verdict: ArtifactContestVerdict; },
): LaneChoice {
  if (verdict.kind === 'lane-won')
    return verdict.lane;
  return 'neither';
}

//endregion Consolidate driver records
