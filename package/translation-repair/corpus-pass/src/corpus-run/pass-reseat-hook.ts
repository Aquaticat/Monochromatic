import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import { shortestHold, } from '@monochromatic-dev/translation-repair-provider/ts';
import { PROVIDER_ORDER, } from '@monochromatic-dev/translation-repair-shared-contract/ts';
import {
  type JudgeSeatPhase,
  type JudgeSeats,
  holdsWithinPass,
  readJudgeSeats,
  type SeatReadingClient,
} from '@monochromatic-dev/translation-repair-run/ts';

//region Per-slice re-seating under a hold
// ONE SHAPE FOR EVERY PHASE THAT RE-SEATS ITS SLICES (ledger X12). The repair
// lane's chunks (class one hundred three), the translate lane's slices and the
// consolidation's (ledger H5) and the lane contest's (ledger X12) each read
// their seats again before a slice while a named hold runs, which is the
// signal a dry-out leaves, hand the slice the roster read, and keep handing it
// over once the hold has ended, so the slices after a dry-out never fall back
// to the roster read before it. Three copies of that memo had grown before
// this one; a fourth phase takes this instead of a fifth copy.
//
// IT COSTS NOTHING WHILE NOTHING IS HELD: one synchronous read of the holds,
// no dryness read. Under a hold the reading itself waits out the shortest hold
// once when a bench the phase leans on cannot reach quorum
// (`run-seats-read.ts`).
//
// A WARNING IS WRITTEN ONCE PER HOLD (round 5). A hold that cannot cure a short bench is not waited for, so every
// slice under it reads the same short bench and the reading warns of it each time; a Xiaomi or DeepSeek hold of hours
// over hundreds of slices wrote hundreds of identical lines. The hook still reads the seats for every slice, since a
// provider going dry changes the seating a slice must run on whether or not its hold would cure anything, and it
// lets a warning through once until the set of held providers changes or empties. The hook cannot skip the read on
// "no running hold would cure": that is also the state of a hold with no short bench at all, which is the state the
// seating is for.
//
// THE MEMORY IS KEYED ON WHICH PROVIDERS ARE HELD AND ON THE WARNING WITHOUT ITS SKIPPED-HOLDS CLAUSE. That clause
// names each skipped hold with the time it has left, which shrinks between slices, so the text alone is a new line
// every time.

/**
 The warning with the clause naming the skipped holds and their lengths taken out, so two readings under the same
 holds say the same thing (the hook keys its memory on which providers are held beside it).

 @param message - the warning as the reading wrote it

 @returns The message without the text from `held: ` to the semicolon that ends the clause

 @example
 ```ts
 // => 'short of quorum: wide 3 of 7; it would not help'
 withoutHeldClause({ message: 'short of quorum: wide 3 of 7; held: deepseek (1 h 59 min 58 s); it would not help', },);
 ```
 */
function withoutHeldClause({ message, }: { readonly message: string; },): string {
  /**
   Where the clause starts, none where the warning names no skipped hold.
   */
  const start = message.indexOf('held: ',);
  if (start === (-1))
    return message;
  /**
   Where the clause ends: the semicolon that follows its last length.
   */
  const end = message.indexOf(
    ';',
    start,
  );
  return (end === (-1))
    ? message.slice(
      0,
      start,
    )
    : message.slice(
      0,
      start,
    ) + message.slice(end + 1,);
}

/**
 What a phase takes from one seat reading: the seating its slices run on, and
 the line naming it.

 @example
 ```ts
 const reseated: Reseated<BenchSeating> = { seating: { modelIds: seats.lateJudges, }, line: 'slice re-seated under a hold: judges=a,b', };
 ```
 */
export type Reseated<SeatingT,> = {
  readonly seating: SeatingT;
  readonly line: string;
};

/**
 Builds the per-slice re-seating one phase's driver calls before each slice.

 @param client - run client whose dryness view and holds are the router's own

 @param signal - entry abort the readings honour

 @param phase - phase whose benches the reading waits on

 @param unseated - seating a slice takes before any hold has run, which keeps
 the roster the phase started on

 @param seatingOf - what this phase takes from a seat reading

 @param l - entry logger, which records every re-seating

 @returns Per-slice reader of the seating the slice runs on

 @example
 ```ts
 const beforeSlice = reseatHookFor({ client, signal, phase: 'lane contest', unseated: {}, seatingOf, l, },);
 ```
 */
export function reseatHookFor<SeatingT,>(
  {
    client,
    signal,
    phase,
    unseated,
    seatingOf,
    l,
  }: {
    readonly client: SeatReadingClient;
    readonly signal: AbortSignal;
    readonly phase: JudgeSeatPhase;
    readonly unseated: SeatingT;
    readonly seatingOf: (args: { readonly seats: JudgeSeats; },) => Reseated<SeatingT>;
    readonly l: Logger;
  },
): () => Promise<SeatingT> {
  /**
   Seating as last read under a hold, handed to every slice after it.
   */
  const latest: { seating: SeatingT; } = { seating: unseated, };
  /**
   Warnings already written under the holds now running, and which providers those holds are on; a later reading under
   the same holds leaves them unsaid.
   */
  const said = {
    held: '',
    warnings: new Set<string>(),
  };
  /**
   The entry logger with a warning let through once per hold.
   */
  const heldLog: Logger = {
    ...l,
    warn: function warnOncePerHold(message: string,): void {
      /**
       The warning as the memory knows it.
       */
      const known = withoutHeldClause({ message, },);
      if (said.warnings
        .has(known,))
        return;
      said.warnings
        .add(known,);
      l.warn(message,);
    },
  };
  return async function reseatBeforeSlice(): Promise<SeatingT> {
    /**
     The holds running now, within what the pass has left.
     */
    const running = holdsWithinPass({ client, },);
    if (shortestHold({ holds: running, },) === 0) {
      said.held = '';
      said.warnings
        .clear();
      return latest.seating;
    }
    /**
     Which providers are held, in the order the roster names them.
     */
    const held = PROVIDER_ORDER.filter(function isHeld(provider,): boolean {
      return running[provider] > 0;
    },)
      .join(',',);
    // A new set of held providers is a new hold: what was said under the last one is said again.
    if (held !== said.held) {
      said.held = held;
      said.warnings
        .clear();
    }
    /**
     Benches as of this slice, the reading waiting out a named hold when a
     bench the phase leans on cannot reach quorum.
     */
    const seats = await readJudgeSeats({
      client,
      phase,
      signal,
      l: heldLog,
    },);
    /**
     What this phase takes from that reading.
     */
    const reseated = seatingOf({ seats, },);
    latest.seating = reseated.seating;
    l.info(`JUDGE SEATS phase=${phase} ${reseated.line}`,);
    return latest.seating;
  };
}

//endregion Per-slice re-seating under a hold
