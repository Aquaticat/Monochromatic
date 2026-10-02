import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { RepairSliceSeating, } from '../repair-contract.ts';
import type {
  TranslateModels,
  TranslateSliceSeating,
} from '../translate-document-contract.ts';
import {
  type Reseated,
  reseatHookFor,
} from './pass-reseat-hook.ts';
import type { JudgeSeats, } from './run-seats.ts';
import {
  readJudgeSeats,
  type SeatReadingClient,
} from './run-seats-read.ts';

//region Translate lane re-seating
// SPLIT OUT OF `pass-entry.ts` for the file-length cap when the thirteenth
// class added it. The lanes phase seats both lanes at once, and the translate
// lane starts after the repair lane has spent minutes, which on 2026-09-07 was
// long enough for Hyper to be held out by its daily limit: every Hyper-only
// writer was refused in the same millisecond and the footnote passage the
// archive lacks stayed unfilled. So the translate lane asks for its seats
// again when it is about to start, through the same reader every phase uses,
// which waits out a named hold when the bench cannot reach quorum.
//
// THE REPAIR LANE RE-SEATS PER CHUNK WHILE A HOLD RUNS (class one hundred
// three, zheermao7, 2026-09-23). Its benches were read once at the lanes
// boundary, and the checkers are not among the benches the lanes phase waits
// on, so when Synthetic's five-hour window ran out two minutes into the lane
// the two Synthetic-only checker seats stayed unreachable for the rest of it:
// ten of twelve checker rounds and their introduced-defect probes ran on one
// voice, short of quorum, while the substitute a dry reading seats
// (zheermao6, dry from the start: two of three on every round) sat idle. The
// per-chunk hook now reads the seats again while a hold is running, which is
// the signal a dry-out leaves (a refusal from a meter that reads dry holds
// the provider out), hands the driver the roster read, and keeps handing it
// over once the hold has ended, so the chunks after the dry-out never fall
// back to the roster read before it. It still costs nothing while nothing is
// held: one synchronous read of the holds.

/**
 Builds the re-seating the lanes driver calls when the translate lane is
 about to start.

 @param client - run client whose dryness view and holds are the router's own

 @param signal - entry abort the reading honours

 @param entryId - entry the log line is tagged with

 @returns Reader of the translate lane's roster as of the moment it is called

 @example
 ```ts
 const reseatTranslate = translateReseatFor({ client, signal, entryId: entry.id, },);
 ```
 */
export function translateReseatFor(
  {
    client,
    signal,
    entryId,
  }: {
    readonly client: SeatReadingClient;
    readonly signal: AbortSignal;
    readonly entryId: string;
  },
): () => Promise<TranslateModels> {
  return async function reseat(): Promise<TranslateModels> {
    /**
     Benches as of the translate lane's start.
     */
    const reseated = await readJudgeSeats({
      client,
      phase: 'translate lane',
      signal,
      l: tagged({ tag: entryId, },),
    },);
    return reseated.translateModels;
  };
}

/**
 What the repair lane takes from a seat reading: its roster, whose checkers
 the line names.

 @param seats - benches as of this chunk

 @returns Roster the chunk runs on, beside the line naming it

 @example
 ```ts
 const { seating, line, } = repairSeatingOf({ seats, },);
 ```
 */
function repairSeatingOf(
  { seats, }: { readonly seats: JudgeSeats; },
): Reseated<RepairSliceSeating> {
  /**
   Checkers the chunk runs on, for the line.
   */
  const checkers = seats.repairModels
    .checkerModelIds
    .join(',',);
  return {
    seating: { repairModels: seats.repairModels, },
    line: `chunk re-seated under a hold: checkers=${checkers}`,
  };
}

/**
 What the translate lane takes from a seat reading: its writers and judges,
 whose writers the line names.

 THE TRANSLATE LANE RE-SEATS TOO (ledger H5, 2026-09-28): it only waited, so a
 dry-out inside the lane left every later slice on the roster read before it,
 the stage classes one hundred three, one hundred nine and one hundred
 thirteen had each fixed for one repair stage at a time.

 @param seats - benches as of this slice

 @returns Roster the slice runs on, beside the line naming it

 @example
 ```ts
 const { seating, line, } = translateSeatingOf({ seats, },);
 ```
 */
function translateSeatingOf(
  { seats, }: { readonly seats: JudgeSeats; },
): Reseated<TranslateSliceSeating> {
  /**
   Writers the slice runs on, for the line.
   */
  const writers = seats.translateModels
    .translatorModelIds
    .join(',',);
  return {
    seating: { translateModels: seats.translateModels, },
    line: `slice re-seated under a hold: writers=${writers}`,
  };
}

/**
 Hooks the lanes driver calls: the translate lane's re-seating when it is
 about to start, and the fresh seat reading each slice of either lane takes
 before it starts while a named hold runs, whose roster that lane's next
 slice runs on, kept once read (class one hundred three for the repair lane,
 ledger H5 for the translate lane).

 @example
 ```ts
 const hooks: LanesHooks = lanesHooksFor({ client, signal, entryId, },);
 ```
 */
export type LanesHooks = {
  readonly reseatTranslate: () => Promise<TranslateModels>;
  readonly beforeSlice: (
    args: { readonly lane: 'repair' | 'translate'; },
  ) => Promise<RepairSliceSeating & TranslateSliceSeating>;
};

/**
 Builds the hooks the lanes driver calls.

 @param client - run client whose dryness view and holds are the router's own

 @param signal - entry abort the readings honour

 @param entryId - entry the log lines are tagged with

 @returns Re-seating and per-chunk wait for both lanes

 @example
 ```ts
 const hooks = lanesHooksFor({ client, signal, entryId: entry.id, },);
 ```
 */
export function lanesHooksFor(
  {
    client,
    signal,
    entryId,
  }: {
    readonly client: SeatReadingClient;
    readonly signal: AbortSignal;
    readonly entryId: string;
  },
): LanesHooks {
  /**
   Entry logger every reading writes to.
   */
  const l = tagged({ tag: entryId, },);
  /**
   Each lane's own re-seating, so neither hands the other a roster it read
   (`pass-reseat-hook.ts`).
   */
  const reseatLane = {
    repair: reseatHookFor<RepairSliceSeating>({
      client,
      signal,
      phase: 'lanes',
      unseated: {},
      seatingOf: repairSeatingOf,
      l,
    },),
    translate: reseatHookFor<TranslateSliceSeating>({
      client,
      signal,
      phase: 'translate lane',
      unseated: {},
      seatingOf: translateSeatingOf,
      l,
    },),
  };
  return {
    reseatTranslate: translateReseatFor({
      client,
      signal,
      entryId,
    },),
    beforeSlice: async function beforeSlice(
      { lane, }: { readonly lane: 'repair' | 'translate'; },
    ): Promise<RepairSliceSeating & TranslateSliceSeating> {
      return await reseatLane[lane]();
    },
  };
}

/**
 Reads the lanes' benches and builds the lanes driver's hooks in one call,
 so the pass entry names both in one place.

 The contest and the consolidation seams read their own benches: XIEPT2 on
 2026-09-03 ran Synthetic dry seven minutes into a 219-minute entry.

 @param client - run client whose dryness view and holds are the router's own

 @param signal - entry abort the readings honour

 @param entryId - entry the log lines are tagged with

 @returns Benches for both lanes as of now, and the hooks for when each
 lane and chunk starts

 @example
 ```ts
 const { seats, lanesHooks, } = await readLanesSeats({ client, signal, entryId: entry.id, },);
 ```
 */
export async function readLanesSeats(
  {
    client,
    signal,
    entryId,
  }: {
    readonly client: SeatReadingClient;
    readonly signal: AbortSignal;
    readonly entryId: string;
  },
): Promise<{
  readonly seats: JudgeSeats;
  readonly lanesHooks: LanesHooks;
}> {
  /**
   Benches for both lanes as of now.
   */
  const seats = await readJudgeSeats({
    client,
    phase: 'lanes',
    signal,
    l: tagged({ tag: entryId, },),
  },);
  return {
    seats,
    lanesHooks: lanesHooksFor({
      client,
      signal,
      entryId,
    },),
  };
}

//endregion Translate lane re-seating
