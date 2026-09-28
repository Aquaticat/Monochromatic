import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { PreparedDocumentPair, } from '../document-preparation.ts';
import {
  type DocumentLanesResult,
  runDocumentLanes,
} from '../document-lanes.ts';
import type { PairedReading, } from '../image-reading-pair.ts';
import type { InsertionAdmission, } from '../insertion-admission.ts';
import type { RefinedSliceSettlement, } from '../refine-slice-settle.ts';
import type { ChunkRepairOutcome, } from '../repair-contract.ts';
import type { SliceCache, } from '../slice-cache.ts';
import type { TranslateSliceRecord, } from '../translate-document-contract.ts';
import type { RunClient, } from './run-client-contract.ts';
import { RUN_PER_CALL_TIMEOUT_MS, } from './run-config.ts';
import type { LanesHooks, } from './pass-reseat.ts';
import type { JudgeSeats, } from './run-seats.ts';

//region Pass lanes
// THE LANES' SEAM (ledger X14): `runPassEntry` hands both lanes their benches
// and their re-seat hooks here, in one place a test can drive. Spread inline
// inside `runPassEntry`, a dropped hook survived every guard, since no test
// drives that function.

/**
 Both lanes' benches as `readLanesSeats` read them, with the hooks that
 re-seat each lane under a hold.

 @example
 ```ts
 const lanesSeating: LanesSeating = await readLanesSeats({ client, signal, entryId, },);
 ```
 */
export type LanesSeating = {
  /**
   Benches as of the lanes' reading.
   */
  readonly seats: JudgeSeats;
  /**
   Hooks each lane calls before a chunk or slice.
   */
  readonly lanesHooks: LanesHooks;
};

/**
 Runs both lanes over one entry's slicing on the benches and hooks the
 entry's lanes reading supplied.

 @param client - run client whose chat surface both lanes ask

 @param prepared - slicing both lanes run over

 @param lanesSeating - benches and re-seat hooks from `readLanesSeats`

 @param pictureReadings - what reading produced per picture

 @param signal - entry deadline and caller abort

 @param overlap - lanes' slice overlap for this entry

 @param repairSliceCache - repair lane's per-slice store

 @param refineSliceCache - refinement's per-slice store

 @param translateSliceCache - translate lane's per-slice store

 @param translateInsertionAdmission - source-only passages licensed for translation

 @param entryId - entry the log lines are tagged with

 @returns What both lanes made of the slicing, with neither preferred

 @example
 ```ts
 const lanes = await runPassLanes({ client, prepared, lanesSeating, pictureReadings, signal, entryId, },);
 ```
 */
export async function runPassLanes(
  {
    client,
    prepared,
    lanesSeating,
    pictureReadings,
    signal,
    overlap,
    repairSliceCache,
    refineSliceCache,
    translateSliceCache,
    translateInsertionAdmission,
    entryId,
  }: {
    readonly client: RunClient;
    readonly prepared: PreparedDocumentPair;
    readonly lanesSeating: LanesSeating;
    readonly pictureReadings: ReadonlyMap<string, PairedReading>;
    readonly signal: AbortSignal;
    readonly overlap?: number;
    readonly repairSliceCache?: SliceCache<ChunkRepairOutcome>;
    readonly refineSliceCache?: SliceCache<RefinedSliceSettlement>;
    readonly translateSliceCache?: SliceCache<TranslateSliceRecord>;
    readonly translateInsertionAdmission?: InsertionAdmission;
    readonly entryId: string;
  },
): Promise<DocumentLanesResult> {
  /**
   Entry logger both lanes write to.
   */
  const l = tagged({ tag: entryId, },);
  l.debug(`${runPassLanes.name}: running both lanes over ${String(prepared.slices
    .length,)} slices`,);
  return await runDocumentLanes({
    client,
    prepared,
    repairModels: lanesSeating.seats
      .repairModels,
    translateModels: lanesSeating.seats
      .translateModels,
    // EACH LANE RE-SEATS UNDER A HOLD (ledger X12 and H5).
    ...lanesSeating.lanesHooks,
    pictureReadings,
    signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    ...((overlap === undefined) ? {} : { overlap, }),
    ...((repairSliceCache === undefined) ? {} : { repairSliceCache, }),
    ...((refineSliceCache === undefined) ? {} : { refineSliceCache, }),
    ...((translateSliceCache === undefined) ? {} : { translateSliceCache, }),
    ...((translateInsertionAdmission === undefined) ? {} : { translateInsertionAdmission, }),
    l,
  },);
}

//endregion Pass lanes
