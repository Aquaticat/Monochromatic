import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import {
  assertCheckerIndependence,
  assertCheckerQuorumReachable,
  type RepairModels,
  type RepairSliceSeating,
} from './repair-contract.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Checker bench at the stage
// THE CHECKER STAGE READS THE SEATING AGAIN AT THE STAGE ITSELF (class one
// hundred nine, zheermao9, 2026-09-24). The class one hundred three re-seat
// lands where a chunk starts, but the repair lane runs eight chunks at once,
// so the chunks already in flight when Synthetic's weekly allowance ran out
// kept the bench read at their start: seven of eight checker rounds asked
// the two Synthetic-only seats a minute after the dry-out and heard one
// voice, short of quorum, while five re-seat lines had already named a
// bench with two reachable seats for chunks not yet started. A chunk's
// checker stage runs after its critics, panel, editor and select judges,
// which is minutes on a live bench, so it asks the hook again here and runs
// on whatever the reading seats now. It costs nothing while nothing is
// held: the hook returns the seating it last read.

/**
 Refuses a chunk roster whose checker bench the contract would refuse: a
 checker who also edits, or fewer checkers than a split verdict can be read
 from. Runs once per chunk before any stage buys anything.
 
 @param models - roster the chunk is seated with
 
 @throws {@link CheckerIndependenceError} when a checker also edits or
 refines
 
 @throws {@link CheckerQuorumError} when the bench is below the floor
 
 @example
 ```ts
 assertCheckerBench({ models, },);
 ```
 */
export function assertCheckerBench(
  { models, }: { readonly models: RepairModels; },
): void {
  assertCheckerIndependence({
    editorModelIds: models.editorModelIds,
    checkerModelIds: models.checkerModelIds,
    selfCertificationPermitted: models.checkerSelfCertificationPermitted ?? false,
  },);
  assertCheckerQuorumReachable({ checkerModelIds: models.checkerModelIds, },);
}

/**
 Seating for a driver given no hook: the roster it was handed stands.
 
 @returns Empty seating
 
 @example
 ```ts
 const seating = await standingSeating();
 ```
 */
export function standingSeating(): Promise<RepairSliceSeating> {
  return Promise.resolve({},);
}

/**
 Whether two benches name the same seats in the same order.
 
 @param left - one bench
 
 @param right - other bench
 
 @returns True when neither seat nor order differs
 
 @example
 ```ts
 const unchanged = sameBench({ left: seated, right: fresh, },);
 ```
 */
function sameBench(
  {
    left,
    right,
  }: {
    readonly left: readonly RosterModelId[];
    readonly right: readonly RosterModelId[];
  },
): boolean {
  if (left.length !== right.length)
    return false;
  return left.every(function sameSeat(
    seat,
    index,
  ): boolean {
    return seat === right[index];
  },);
}

/**
 Checkers the stage runs on: the bench the seating read now names where a
 hook is given and that bench differs, else the chunk's own.
 
 @param models - roster the chunk was seated with
 
 @param reseat - reads the seating as of now; `standingSeating` where the
 roster the driver was given stands for the whole run
 
 @param l - repair-lane logger
 
 @returns Checker ids for this chunk's checker stage and its probe
 
 @throws {@link CheckerQuorumError} when the bench read now is below the
 checker floor, since a stage the contract refuses must not start
 
 @example
 ```ts
 const stageCheckers = await checkerBenchAtStage({ models, reseat, l, },);
 ```
 */
export async function checkerBenchAtStage(
  {
    models,
    reseat,
    l,
  }: {
    readonly models: RepairModels;
    readonly reseat: () => Promise<RepairSliceSeating>;
    readonly l: Logger;
  },
): Promise<readonly RosterModelId[]> {
  /**
   Seating as of now.
   */
  const seating = await reseat();
  /**
   Roster the reading seats, absent while the given one stands.
   */
  const reseated = seating.repairModels;
  if (reseated === undefined)
    return models.checkerModelIds;
  /**
   Bench the reading seats.
   */
  const fresh = reseated.checkerModelIds;
  if (sameBench({
    left: models.checkerModelIds,
    right: fresh,
  },))
    return models.checkerModelIds;
  assertCheckerQuorumReachable({ checkerModelIds: fresh, },);
  l.info(`checker stage re-seated: ${fresh.join(',',)} (the chunk was seated with ${
    models.checkerModelIds
      .join(',',)
  })`,);
  return fresh;
}

//endregion Checker bench at the stage
