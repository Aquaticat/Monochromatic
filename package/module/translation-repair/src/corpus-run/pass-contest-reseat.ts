import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { LaneContestSliceSeating, } from '../lane-contest-slice-seating.ts';
import {
  awaitBenchQuorum,
  type SeatReadingClient,
} from './run-seats-read.ts';

//region Lane contest re-seating
// THE LANE CONTEST'S PER-SLICE HOOK (ledger X12), beside the consolidation's
// (`pass-consolidate-reseat.ts`), so a test can drive it with the reading rig
// the other phases' hooks are tested with.

/**
 Hook the lane contest driver calls before each slice.

 @example
 ```ts
 const hooks: ContestHooks = contestHooksFor({ client, signal, l, },);
 ```
 */
export type ContestHooks = {
  readonly beforeSlice: () => Promise<LaneContestSliceSeating>;
};

/**
 Builds the lane contest's per-slice hook.

 @param client - run client whose dryness view and holds are the router's own

 @param signal - entry abort the readings honour

 @param l - entry logger

 @returns Per-slice reader, handing the slice the judges it runs on

 @example
 ```ts
 const hooks = contestHooksFor({ client, signal, l, },);
 ```
 */
export function contestHooksFor(
  {
    client,
    signal,
    l,
  }: {
    readonly client: SeatReadingClient;
    readonly signal: AbortSignal;
    readonly l: Logger;
  },
): ContestHooks {
  return {
    beforeSlice: async function beforeContestSlice(): Promise<LaneContestSliceSeating> {
      await awaitBenchQuorum({
        client,
        phase: 'lane contest',
        signal,
        l,
      },);
      return {};
    },
  };
}

//endregion Lane contest re-seating
