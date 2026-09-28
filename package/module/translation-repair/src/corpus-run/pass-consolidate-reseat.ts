import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import { shortestHold, } from '../budget-hold-wait.ts';
import type { ConsolidateSliceSeating, } from '../consolidate-slice-seating.ts';
import { consolidationPolishConfiguration, } from '../consolidation-polish-config.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import {
  readJudgeSeats,
  type SeatReadingClient,
} from './run-seats-read.ts';

//region Consolidation re-seating
// THE CONSOLIDATION'S PER-SLICE HOOK, split out of `pass-consolidate.ts` so a
// test can drive it with the reading rig the lanes' hooks are tested with
// (ledger H5). Every slice waits out a named hold that keeps the slate from
// quorum (the thirteenth class's second face, the fourth hakureico pass).
//
// IT RE-SEATS THE SLICE TOO (ledger H5, 2026-09-28), as the lanes' hooks do
// (`pass-reseat.ts`). It only waited, so a dry-out inside the consolidation
// left every later slice on the writers, slate judges and naturalness roles
// read before it, the stage classes one hundred three, one hundred nine and
// one hundred thirteen had each fixed for one repair stage at a time. While a
// hold runs it reads the seats again, which waits out the hold where the bench
// cannot reach quorum, builds the roster `pass-consolidate.ts` builds from that
// reading, and keeps handing it over once the hold has ended. While nothing is
// held it costs one synchronous read of the holds.

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

 @param prepared - page whose guard facts the naturalness roles carry, as the
 consolidation's starting roster carries them

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
    prepared,
    l,
  }: {
    readonly client: SeatReadingClient;
    readonly signal: AbortSignal;
    readonly prepared: PreparedDocumentPair;
    readonly l: Logger;
  },
): ConsolidationHooks {
  /**
   Seating as last read under a hold, handed to every slice after it; empty
   until a hold has run, which keeps the roster the consolidation started on.
   */
  const latest: { seating: ConsolidateSliceSeating; } = { seating: {}, };
  return {
    beforeSlice: async function beforeConsolidationSlice(): Promise<ConsolidateSliceSeating> {
      if (shortestHold({ holds: client.providerHolds(), },) === 0)
        return latest.seating;
      /**
       Benches as of this slice, the reading waiting out a named hold when the
       slate cannot reach quorum.
       */
      const seats = await readJudgeSeats({
        client,
        phase: 'consolidation',
        signal,
        l,
      },);
      /**
       Naturalness roles that reading configures.
       */
      const polish = consolidationPolishConfiguration({
        prepared,
        models: seats.repairModels,
        gateModelIds: seats.lateJudges,
      },);
      latest.seating = {
        roster: {
          modelIds: seats.writers,
          judgeModelIds: seats.slateJudges,
          ...((polish.kind === 'configured') ? { polishConfig: polish.config, } : {}),
        },
      };
      /**
       Writers the slice runs on, for the line.
       */
      const writers = seats.writers
        .join(',',);
      /**
       Slate judges the slice runs on, for the line.
       */
      const judges = seats.slateJudges
        .join(',',);
      l.info(
        `JUDGE SEATS phase=consolidation slice re-seated under a hold: writers=${writers} `
          + `slateJudges=${judges} polish=${polish.kind}`,
      );
      return latest.seating;
    },
  };
}

//endregion Consolidation re-seating
