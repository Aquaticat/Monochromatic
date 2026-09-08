import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import {
  HOLD_POLL_MS,
  shortestHold,
  waitOutHold,
} from '../budget-hold-wait.ts';
import type { BudgetView, } from '../provider-budget.ts';
import {
  PROVIDER_ORDER,
  providerRecord,
} from '../provider-name.ts';
import type { RunClient, } from './run-client-contract.ts';
import {
  type JudgeSeats,
  judgeSeatsFor,
} from './run-seats.ts';
import {
  benchesOf,
  unreachableWritingBenches,
  WritingBenchUnreachableError,
} from './run-seats-floor.ts';
import {
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
// had refused, and the entry stopped INCOMPLETE. So every driver now asks
// `awaitBenchQuorum` before each chunk, which costs nothing while no hold is
// running (one synchronous read of the holds) and waits out the shortest
// hold once when a bench the phase leans on cannot reach quorum.

/**
 * Client surface the readings need: the router's dryness view and holds.
 *
 * @example
 * ```ts
 * const client: SeatReadingClient = createRunClient();
 * ```
 */
export type SeatReadingClient = Pick<RunClient, 'providerDryness' | 'providerHolds'>;

/**
 * The view when the budgets could not be read: nothing is dry.
 *
 * @returns Wet
 *
 * @example
 * ```ts
 * const dry = providerRecord({ of: wetWhenUnread, },);
 * ```
 */
function wetWhenUnread(): boolean {
  return false;
}

/**
 * Reads the dryness view, waiting out the shortest running hold once when a
 * bench the phase leans on cannot reach quorum among the seats a wet provider
 * serves, and reading again after the wait; when a judge bench is short and
 * no provider has named its return, the reading says so and seats what it
 * read; when a writing bench is below its floor with nothing to wait for, or
 * still below it after the wait, the entry stops.
 *
 * @throws {@link WritingBenchUnreachableError} when a writing bench the phase
 * leans on cannot write a slate and no hold promises it back
 *
 * @param client - run client whose dryness view and holds are the router's own
 *
 * @param phase - phase about to start or continue, which names the benches
 *
 * @param signal - entry abort the wait honours
 *
 * @param l - entry logger, which records the shortfall and the wait
 *
 * @param pollMs - how often the wait checks for abort
 *
 * @returns Dryness the phase seats on, and how long was waited for it
 *
 * @example
 * ```ts
 * const { dry, waitMs, } = await readDrynessPastShortBench({ client, phase, signal, l, pollMs: HOLD_POLL_MS, },);
 * ```
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
}> {
  /**
   * Reads which providers are dry, or none when the view could not be read.
   *
   * @returns Dryness per provider, holds folded in
   */
  async function readDryness(): Promise<BudgetView> {
    try {
      return await client.providerDryness({ signal, },);
    } catch (error) {
      l.warn(`judge seats: the budget view could not be read (${String(error,)}); seating the full bench`,);
      return providerRecord({ of: wetWhenUnread, },);
    }
  }
  /**
   * Dryness as first read.
   */
  const first = await readDryness();
  /**
   * How long each provider's refusal still holds it out.
   */
  const holds = client.providerHolds();
  /**
   * The first hold to end, zero when no provider is held.
   */
  const shortest = shortestHold({ holds, },);
  /**
   * Benches this phase leans on, in the order the line prints them.
   */
  const names = phaseBenches({ phase, },);
  /**
   * Benches as first read.
   */
  const benches = benchesOf({ seats: judgeSeatsFor({ dry: first, },), },);
  /**
   * Benches this phase leans on that cannot reach quorum as first read.
   */
  const short = shortBenches({
    benches,
    names,
    dry: first,
  },);
  /**
   * Writing benches this phase leans on that cannot write a slate as first read.
   */
  const unreachable = unreachableWritingBenches({
    benches,
    names,
    dry: first,
  },);
  if ((short.length === 0) && (unreachable.length === 0)) {
    return {
      dry: first,
      waitMs: 0,
    };
  }
  if (shortest === 0) {
    if (unreachable.length > 0) {
      // THE FIFTEENTH CLASS: a writing bench below its floor with nothing to
      // wait for stops the entry rather than writing a one-writer page.
      l.error(`JUDGE SEATS phase=${phase} writing bench unreachable: ${unreachable.join('; ',)}; stopping the entry`,);
      throw new WritingBenchUnreachableError({
        phase,
        clauses: unreachable,
      },);
    }
    // SAID EVEN WHEN THERE IS NOTHING TO WAIT FOR. The seventh hakureico
    // launch (2026-09-08, Bedrock alone) printed `readers=4 roster=10
    // withheld=none` at the pictures with three providers dry, since
    // `withheld=` names only the seats the slowness and cost rules take, and
    // stopped INCOMPLETE twenty seconds later with no reader reachable. A
    // spent balance names no return, so the phase runs on what is reachable;
    // the line says so before it starts.
    l.warn(
      `JUDGE SEATS phase=${phase} short of quorum: ${short.join('; ',)}; `
        + 'no provider has named its return, so the phase runs on what is reachable',
    );
    return {
      dry: first,
      waitMs: 0,
    };
  }
  /**
   * How long this reading waits: the shortest running hold.
   */
  const waitMs = shortest;
  /**
   * Each provider's hold, for the line.
   */
  const held = PROVIDER_ORDER.map(function holdOf(provider,): string {
    return `${provider} ${String(holds[provider],)}ms`;
  },);
  l.warn(
    `JUDGE SEATS phase=${phase} short of quorum: ${short.join('; ',)}; holds ${held.join(', ',)}; `
      + `waiting ${String(waitMs,)}ms for the shortest hold to end rather than seating a bench that cannot settle`,
  );
  await waitOutHold({
    ms: waitMs,
    signal,
    pollMs,
  },);
  /**
   * Dryness after the wait.
   */
  const again = await readDryness();
  /**
   * Writing benches still below the floor after the one wait this reading takes.
   */
  const stillUnreachable = unreachableWritingBenches({
    benches: benchesOf({ seats: judgeSeatsFor({ dry: again, },), },),
    names,
    dry: again,
  },);
  if (stillUnreachable.length > 0) {
    l.error(
      `JUDGE SEATS phase=${phase} writing bench unreachable after waiting ${String(waitMs,)}ms: `
        + `${stillUnreachable.join('; ',)}; stopping the entry`,
    );
    throw new WritingBenchUnreachableError({
      phase,
      clauses: stillUnreachable,
    },);
  }
  return {
    dry: again,
    waitMs,
  };
}

/**
 * Reads every provider's dryness and derives the benches for one phase of
 * one entry, waiting out a named hold first when the phase could not settle
 * without it.
 *
 * @param client - run client whose dryness view and holds are the router's own
 *
 * @param phase - phase about to start, which the reading seats
 *
 * @param signal - entry abort
 *
 * @param l - entry logger, which records the reading and the bench
 *
 * @param pollMs - how often a wait checks for abort
 *
 * @returns Benches for this phase
 *
 * @example
 * ```ts
 * const seats = await readJudgeSeats({ client, phase: 'lanes', signal, l, },);
 * ```
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
  /**
   * Dryness this phase seats on, any named hold waited out.
   */
  const {
    dry,
    waitMs,
  } = await readDrynessPastShortBench({
    client,
    phase,
    signal,
    l,
    pollMs,
  },);
  /**
   * Benches for this reading.
   */
  const seats = judgeSeatsFor({ dry, },);
  /**
   * Each bench, named once for the line.
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
   * Each provider's state, for the line.
   */
  const states = PROVIDER_ORDER.map(function stateOf(provider,): string {
    return `${provider}=${dry[provider] ? 'dry' : 'wet'}`;
  },);
  l.info(
    `JUDGE SEATS phase=${phase} ${states.join(' ',)} wide=${String(wideSeats.length,)} `
      + `select=${String(selectJudges.length,)} late=${String(lateJudges.length,)} `
      + `slate=${String(slateJudges.length,)} checkers=${String(checkers.length,)} `
      + `translators=${String(translators.length,)} readers=${String(readers.length,)} `
      + `writers=${String(writers.length,)} roster=${String(roster.length,)} `
      + `withheld=${(withheld.length === 0) ? 'none' : withheld.join(',',)} `
      + `waited=${String(waitMs,)}ms`,
  );
  return seats;
}

/**
 * Waits, before one chunk starts, until the benches its phase leans on can
 * reach quorum again, when a named hold is keeping them from it.
 *
 * COSTS NOTHING WHILE NOTHING IS HELD: one synchronous read of the holds and
 * no dryness read, so a pass under wet providers asks its meters exactly as
 * often as before.
 *
 * @param client - run client whose dryness view and holds are the router's own
 *
 * @param phase - phase the chunk belongs to, which names the benches
 *
 * @param signal - entry abort the wait honours
 *
 * @param l - entry logger, which records the shortfall and the wait
 *
 * @param pollMs - how often a wait checks for abort
 *
 * @returns How long was waited, zero when the chunk could start at once
 *
 * @example
 * ```ts
 * await awaitBenchQuorum({ client, phase: 'consolidation', signal, l, },);
 * ```
 */
export async function awaitBenchQuorum(
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
): Promise<number> {
  if (shortestHold({ holds: client.providerHolds(), },) === 0)
    return 0;
  /**
   * The reading, any named hold waited out.
   */
  const { waitMs, } = await readDrynessPastShortBench({
    client,
    phase,
    signal,
    l,
    pollMs,
  },);
  if (waitMs > 0)
    l.info(`JUDGE SEATS phase=${phase} chunk resumes after waiting ${String(waitMs,)}ms`,);
  return waitMs;
}

//endregion Seat readings past a named hold
