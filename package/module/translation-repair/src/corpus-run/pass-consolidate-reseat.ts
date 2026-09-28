import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { ConsolidateSliceSeating, } from '../consolidate-slice-seating.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import {
  awaitBenchQuorum,
  type SeatReadingClient,
} from './run-seats-read.ts';

//region Consolidation re-seating
// THE CONSOLIDATION'S PER-SLICE HOOK, split out of `pass-consolidate.ts` so a
// test can drive it with the reading rig the lanes' hooks are tested with
// (ledger H5). Every slice waits out a named hold that keeps the slate from
// quorum (the thirteenth class's second face, the fourth hakureico pass).

/**
 Hook the consolidation driver calls before each slice.

 @example
 ```ts
 const hooks: ConsolidationHooks = consolidationHooksFor({ client, signal, prepared, l, },);
 ```
 */
export type ConsolidationHooks = {
  readonly beforeSlice: () => Promise<ConsolidateSliceSeating>;
};

/**
 Builds the consolidation's per-slice hook.

 @param client - run client whose dryness view and holds are the router's own

 @param signal - entry abort the readings honour

 @param l - entry logger

 @returns Per-slice wait, handing the slice the roster it runs on

 @example
 ```ts
 const hooks = consolidationHooksFor({ client, signal, prepared, l, },);
 ```
 */
export function consolidationHooksFor(
  {
    client,
    signal,
    l,
  }: {
    readonly client: SeatReadingClient;
    readonly signal: AbortSignal;
    readonly prepared: PreparedDocumentPair;
    readonly l: Logger;
  },
): ConsolidationHooks {
  return {
    beforeSlice: async function beforeConsolidationSlice(): Promise<ConsolidateSliceSeating> {
      await awaitBenchQuorum({
        client,
        phase: 'consolidation',
        signal,
        l,
      },);
      return {};
    },
  };
}

//endregion Consolidation re-seating
