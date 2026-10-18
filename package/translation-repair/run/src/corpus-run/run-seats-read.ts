import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import {
  HOLD_POLL_MS,
  shortestHold,
  waitOutHold,
} from '@monochromatic-dev/translation-repair-provider/ts';
import { wordForCount, } from '@monochromatic-dev/translation-repair-typography/ts';
import { exchangeFailureLogText, } from '@monochromatic-dev/translation-repair-provider-stream/ts';
import {
  markFailureWritten,
  RUN_SEATS,
  SEAT_WITHHOLD_ASKS,
} from '@monochromatic-dev/translation-repair-stage/ts';
import type { BudgetView, } from '@monochromatic-dev/translation-repair-provider/ts';
import {
  PROVIDER_ORDER,
  providerRecord,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';
import type { RunClient, } from './run-client-contract.ts';
import {
  type JudgeSeats,
  judgeSeatsFor,
} from './run-seats.ts';
import {
  belowFloorWritingBenches,
  benchesOf,
  PHASES_WITHOUT_WRITER_STOP,
  unreachableWritingBenches,
  WritingBenchUnreachableError,
} from './run-seats-floor.ts';
import {
  type BenchName,
  type JudgeSeatPhase,
  phaseBenches,
  shortBenches,
} from './run-seats-wait.ts';

//region Seat readings past a named hold
// THE READING EVERY PHASE AND EVERY CHUNK TAKES before it asks anyone.
//
// SPLIT OUT OF `run-seats.ts` when the thirteenth class grew a second face.
// The phase-boundary wait of `752bf9a9b` covered the third hakureico pass's
// case: a hold that began before a phase. The fourth pass met the other case:
// Hyper's daily limit named 923 s two minutes into consolidation, after the
// phase had seated, so eighteen chunks ran on the two Bedrock seats, slice 5's
// slate declined under quorum-not-met with a standing text the block floor
// had refused, and the entry stopped INCOMPLETE. So every phase that buys slice
// by slice (both lanes, the lane contest and the consolidation) now takes
// this reading again before a slice while a hold runs, which waits out the
// shortest hold once when a bench the phase leans on cannot reach quorum, and
// seats the slice on what it read (`pass-reseat-hook.ts`, ledger H5 and X12).
// `awaitBenchQuorum` did the waiting alone until the last of those hooks moved
// onto the shared re-seat on 2026-09-28, and was removed.

/**
 Client surface the readings need: the router's dryness view and holds.

 @example
 ```ts
 const client: SeatReadingClient = createRunClient();
 ```
 */
export type SeatReadingClient = Pick<RunClient, 'providerDryness' | 'providerHolds'>;

/**
 The view when the budgets could not be read: nothing is dry.

 @returns Wet

 @example
 ```ts
 const dry = providerRecord({ of: wetWhenUnread, },);
 ```
 */
function wetWhenUnread(): boolean {
  return false;
}

/**
 Refusal for a writing bench that stops the entry, marked as already written,
 since the reading writes its own `JUDGE SEATS` line before throwing it.

 MARKED SO NO OUTER LAYER WRITES IT AGAIN (ledger B413). The reading runs in
 the per-slice hook of every slice-by-slice phase, so two slices side by side
 can each stop the entry; the overlapped map throws the lower one and wrote
 the higher one a second line under the caller's stop, and would write one
 without a stop too.

 @param phase - phase the reading was taken for

 @param clauses - one clause per writing bench below its floor

 @returns The refusal to throw

 @example
 ```ts
 throw writtenRefusal({ phase: 'lanes', clauses: ['editors 0 of 3 reachable, floor 2',], },);
 ```
 */
function writtenRefusal(
  {
    phase,
    clauses,
  }: {
    readonly phase: JudgeSeatPhase;
    readonly clauses: readonly string[];
  },
): WritingBenchUnreachableError {
  /**
   The refusal the entry stops with.
   */
  const refusal = new WritingBenchUnreachableError({
    phase,
    clauses,
  },);
  markFailureWritten({ error: refusal, },);
  return refusal;
}

/**
 Reads the dryness view, waiting out the shortest running hold once when a
 bench the phase leans on cannot reach quorum among the seats a wet provider
 serves, and reading again after the wait; when a judge bench is short and
 no provider has named its return, the reading says so and seats what it
 read; when a writing bench is below its floor with nothing to wait for, or
 still below it after the wait, the entry stops, except in a phase that goes on
 without its writers (`PHASES_WITHOUT_WRITER_STOP`), where the reading says so in
 one error line naming the bench and returns the benches below the floor.

 @throws {@link WritingBenchUnreachableError} when a writing bench the phase
 leans on cannot write a slate and no hold promises it back, in a phase that
 stops for it

 @param client - run client whose dryness view and holds are the router's own

 @param phase - phase about to start or continue, which names the benches

 @param signal - entry abort the wait honours

 @param l - entry logger, which records the shortfall and the wait

 @param pollMs - how often the wait checks for abort

 @returns Dryness the phase seats on, how long was waited for it, and one clause
 for each writing bench of a phase that goes on without its writers that is below
 its floor

 @example
 ```ts
 const { dry, waitMs, } = await readDrynessPastShortBench({ client, phase, signal, l, pollMs: HOLD_POLL_MS, },);
 ```
 */
async function readDrynessPastShortBench(
  {
    client,
    phase,
    signal,
    l,
    pollMs,
  }: {
    readonly client: SeatReadingClient;
    readonly phase: JudgeSeatPhase;
    readonly signal: AbortSignal;
    readonly l: Logger;
    readonly pollMs: number;
  },
): Promise<{
  readonly dry: BudgetView;
  readonly waitMs: number;
  readonly unreachableWriters: readonly string[];
}> {
  /**
   Reads which providers are dry, or none when the view could not be read.

   @returns Dryness per provider, holds folded in
   */
  async function readDryness(): Promise<BudgetView> {
    try {
      return await client.providerDryness({ signal, },);
    } catch (error) {
      l.warn(`judge seats: the budget view could not be read (${exchangeFailureLogText({ error, },)}); seating the full bench`,);
      return providerRecord({ of: wetWhenUnread, },);
    }
  }
  /**
   Dryness as first read.
   */
  const first = await readDryness();
  /**
   How long each provider's refusal still holds it out.
   */
  const holds = client.providerHolds();
  /**
   The first hold to end, zero when no provider is held.
   */
  const shortest = shortestHold({ holds, },);
  /**
   Benches this phase leans on, in the order the line prints them.
   */
  const names = phaseBenches({ phase, },);
  /**
   Benches as first read.
   */
  const benches = benchesOf({ seats: judgeSeatsFor({ dry: first, },), },);
  /**
   Benches this phase leans on that cannot reach quorum as first read.
   */
  const short = shortBenches({
    benches,
    names,
    dry: first,
  },);
  /**
   Writing benches this phase leans on that cannot write a slate as first read.
   */
  const unreachable = unreachableWritingBenches({
    benches,
    names,
    dry: first,
  },);
  /**
   Whether this phase goes on when a writing bench it leans on is below its floor.
   */
  const goesOn = PHASES_WITHOUT_WRITER_STOP.has(phase,);
  if ((short.length === 0) && (unreachable.length === 0)) {
    return {
      dry: first,
      waitMs: 0,
      unreachableWriters: [],
    };
  }
  if (shortest === 0) {
    if ((unreachable.length > 0) && (!goesOn)) {
      // THE FIFTEENTH CLASS: a writing bench below its floor with nothing to
      // wait for stops the entry rather than writing a one-writer page.
      l.error(`JUDGE SEATS phase=${phase} writing bench unreachable: ${unreachable.join('; ',)}; stopping the entry`,);
      throw writtenRefusal({
        phase,
        clauses: unreachable,
      },);
    }
    if (unreachable.length > 0) {
      // A PHASE THAT GOES ON WITHOUT ITS WRITERS says so once, naming the
      // bench, and never says the entry stops, since it does not.
      l.error(
        `JUDGE SEATS phase=${phase} writing bench unreachable: ${unreachable.join('; ',)}; `
          + 'no provider has named its return, so the phase goes on without its writers',
      );
    }
    /**
     Writing benches below the floor, which the error line of a phase that goes on has named.
     */
    const belowFloor = new Set(belowFloorWritingBenches({
      benches,
      names,
      dry: first,
    },)
      .map(function nameOf({ name, },): BenchName {
        return name;
      },),);
    /**
     Benches short of quorum that no error line has named.
     */
    const shortElsewhere = shortBenches({
      benches,
      names: names.filter(function isNotNamedAbove(name,): boolean {
        return !(goesOn && belowFloor.has(name,));
      },),
      dry: first,
    },);
    if (shortElsewhere.length > 0) {
      // SAID EVEN WHEN THERE IS NOTHING TO WAIT FOR. The seventh hakureico
      // launch (2026-09-08, Bedrock alone) printed `readers=4 roster=10
      // withheld=none` at the pictures with three providers dry, since
      // `withheld=` names only the seats the slowness and cost rules take, and
      // stopped INCOMPLETE twenty seconds later with no reader reachable. A
      // spent balance names no return, so the phase runs on what is reachable;
      // the line says so before it starts.
      l.warn(
        `JUDGE SEATS phase=${phase} short of quorum: ${shortElsewhere.join('; ',)}; `
          + 'no provider has named its return, so the phase runs on what is reachable',
      );
    }
    return {
      dry: first,
      waitMs: 0,
      unreachableWriters: unreachable,
    };
  }
  /**
   How long this reading waits: the shortest running hold.
   */
  const waitMs = shortest;
  /**
   Each provider's hold, for the line.
   */
  const held = PROVIDER_ORDER.map(function holdOf(provider,): string {
    return `${provider} ${String(holds[provider],)}ms`;
  },);
  l.warn(
    `JUDGE SEATS phase=${phase} short of quorum: ${short.join('; ',)}; holds ${held.join(', ',)}; `
      + `waiting ${String(waitMs,)}ms for the shortest hold to end rather than seating a bench short of its quorum`,
  );
  await waitOutHold({
    ms: waitMs,
    signal,
    pollMs,
  },);
  /**
   Dryness after the wait.
   */
  const again = await readDryness();
  /**
   Writing benches still below the floor after the one wait this reading takes.
   */
  const stillUnreachable = unreachableWritingBenches({
    benches: benchesOf({ seats: judgeSeatsFor({ dry: again, },), },),
    names,
    dry: again,
  },);
  if ((stillUnreachable.length > 0) && (!goesOn)) {
    l.error(
      `JUDGE SEATS phase=${phase} writing bench unreachable after waiting ${String(waitMs,)}ms: `
        + `${stillUnreachable.join('; ',)}; stopping the entry`,
    );
    throw writtenRefusal({
      phase,
      clauses: stillUnreachable,
    },);
  }
  if (stillUnreachable.length > 0) {
    l.error(
      `JUDGE SEATS phase=${phase} writing bench unreachable after waiting ${String(waitMs,)}ms: `
        + `${stillUnreachable.join('; ',)}; the phase goes on without its writers`,
    );
  }
  return {
    dry: again,
    waitMs,
    unreachableWriters: stillUnreachable,
  };
}

/**
 Reads every provider's dryness and derives the benches for one phase of
 one entry, waiting out a named hold first when a bench the phase leans on
 would otherwise sit short of its quorum, and says which writing benches of a
 phase that goes on without its writers are below their floor.

 @param client - run client whose dryness view and holds are the router's own

 @param phase - phase about to start, which the reading seats

 @param signal - entry abort

 @param l - entry logger, which records the reading and the bench

 @param pollMs - how often a wait checks for abort

 @returns Benches for this phase, and one clause for each writing bench below the
 floor that the phase goes on without; none for a phase that stops for it

 @throws {@link WritingBenchUnreachableError} when a writing bench the phase
 leans on cannot write a slate, no hold promises it back, and the phase stops for it

 @example
 ```ts
 const { seats, unreachableWriters, } = await readPhaseSeats({ client, phase: 'page consistency', signal, l, },);
 ```
 */
export async function readPhaseSeats(
  {
    client,
    phase,
    signal,
    l,
    pollMs = HOLD_POLL_MS,
  }: {
    readonly client: SeatReadingClient;
    readonly phase: JudgeSeatPhase;
    readonly signal: AbortSignal;
    readonly l: Logger;
    readonly pollMs?: number;
  },
): Promise<{
  readonly seats: JudgeSeats;
  readonly unreachableWriters: readonly string[];
}> {
  /**
   Dryness this phase seats on, any named hold waited out.
   */
  const {
    dry,
    waitMs,
    unreachableWriters,
  } = await readDrynessPastShortBench({
    client,
    phase,
    signal,
    l,
    pollMs,
  },);
  /**
   Benches for this reading.
   */
  const seats = judgeSeatsFor({ dry, },);
  /**
   Each bench, named once for the line.
   */
  const {
    wideSeats,
    selectJudges,
    lateJudges,
    slateJudges,
    checkers,
    translators,
    readers,
    writers,
    roster,
    withheld,
  } = seats;
  /**
   Each provider's state, for the line.
   */
  const states = PROVIDER_ORDER.map(function stateOf(provider,): string {
    return `${provider}=${dry[provider] ? 'dry' : 'wet'}`;
  },);
  /**
   Counts of the seats the run has withheld for throwing on every ask.
   */
  const withheldCounts = RUN_SEATS.withheld({ minAsks: SEAT_WITHHOLD_ASKS, },);
  /**
   Each withheld seat with the counts that withheld it, as the line names it.
   */
  const threwWithheld = withheldCounts.map(
    function reasonOf(count,): string {
      return `${count.modelId} (threw ${String(count.threw,)} of ${String(count.asked,)} ${
        wordForCount({
          count: count.asked,
          one: 'ask',
          many: 'asks',
        },)
      })`;
    },
  );
  l.info(
    `JUDGE SEATS phase=${phase} ${states.join(' ',)} wide=${String(wideSeats.length,)} `
      + `select=${String(selectJudges.length,)} late=${String(lateJudges.length,)} `
      + `slate=${String(slateJudges.length,)} checkers=${String(checkers.length,)} `
      + `translators=${String(translators.length,)} readers=${String(readers.length,)} `
      + `writers=${String(writers.length,)} roster=${String(roster.length,)} `
      + `withheld=${(withheld.length === 0) ? 'none' : withheld.join(',',)} `
      + `threw-withheld=${(threwWithheld.length === 0) ? 'none' : threwWithheld.join(',',)} `
      + `waited=${String(waitMs,)}ms`,
  );
  return {
    seats,
    unreachableWriters,
  };
}

/**
 Reads every provider's dryness and derives the benches for one phase of
 one entry, waiting out a named hold first when a bench the phase leans on
 would otherwise sit short of its quorum.

 @param client - run client whose dryness view and holds are the router's own

 @param phase - phase about to start, which the reading seats

 @param signal - entry abort

 @param l - entry logger, which records the reading and the bench

 @param pollMs - how often a wait checks for abort

 @returns Benches for this phase

 @throws {@link WritingBenchUnreachableError} when a writing bench the phase
 leans on cannot write a slate and no hold promises it back, in a phase that
 stops for it

 @example
 ```ts
 const seats = await readJudgeSeats({ client, phase: 'lanes', signal, l, },);
 ```
 */
export async function readJudgeSeats(
  {
    client,
    phase,
    signal,
    l,
    pollMs = HOLD_POLL_MS,
  }: {
    readonly client: SeatReadingClient;
    readonly phase: JudgeSeatPhase;
    readonly signal: AbortSignal;
    readonly l: Logger;
    readonly pollMs?: number;
  },
): Promise<JudgeSeats> {
  return (await readPhaseSeats({
    client,
    phase,
    signal,
    l,
    pollMs,
  },))
    .seats;
}

//endregion Seat readings past a named hold
