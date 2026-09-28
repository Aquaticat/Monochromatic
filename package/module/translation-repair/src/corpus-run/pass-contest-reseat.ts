import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { BenchSeating, } from '../bench-seating.ts';
import {
  type Reseated,
  reseatHookFor,
} from './pass-reseat-hook.ts';
import type { JudgeSeats, } from './run-seats.ts';
import type { SeatReadingClient, } from './run-seats-read.ts';

//region Lane contest re-seating
// THE LANE CONTEST'S PER-SLICE HOOK (ledger X12), beside the consolidation's
// (`pass-consolidate-reseat.ts`), so a test can drive it with the reading rig
// the other phases' hooks are tested with.
//
// THE CONTEST READ ITS JUDGES ONCE and had no per-slice wait: `e17d0c487`
// (2026-09-07) reached the lanes and the consolidation only. Holds began
// inside a contest 222 times in 12 of 4,122 run logs (measured 2026-09-28), and
// each left every later slice on the judges read before it. The hook now
// re-reads the judges while a hold runs, waiting it out where the bench cannot
// reach quorum, and keeps handing them over once it has ended
// (`pass-reseat-hook.ts`).

/**
 Hook the lane contest driver calls before each slice.

 @example
 ```ts
 const hooks: ContestHooks = contestHooksFor({ client, signal, l, },);
 ```
 */
export type ContestHooks = {
  readonly beforeSlice: () => Promise<BenchSeating>;
};

/**
 What the lane contest takes from a seat reading: the late judges, as
 `pass-contest.ts` seats them.

 @param seats - benches as of this slice

 @returns Judges the slice runs on, beside the line naming them

 @example
 ```ts
 const { seating, line, } = contestSeatingOf({ seats, },);
 ```
 */
function contestSeatingOf(
  { seats, }: { readonly seats: JudgeSeats; },
): Reseated<BenchSeating> {
  /**
   Judges the slice runs on, for the line.
   */
  const judges = seats.lateJudges
    .join(',',);
  return {
    seating: { modelIds: seats.lateJudges, },
    line: `slice re-seated under a hold: judges=${judges}`,
  };
}

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
    beforeSlice: reseatHookFor<BenchSeating>({
      client,
      signal,
      phase: 'lane contest',
      unseated: {},
      seatingOf: contestSeatingOf,
      l,
    },),
  };
}

//endregion Lane contest re-seating
