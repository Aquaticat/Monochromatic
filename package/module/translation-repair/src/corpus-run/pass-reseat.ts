import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { TranslateModels, } from '../translate-document-contract.ts';
import type { RunClient, } from './run-client-contract.ts';
import type { JudgeSeats, } from './run-seats.ts';
import {
  awaitBenchQuorum,
  readJudgeSeats,
} from './run-seats-read.ts';
import type { JudgeSeatPhase, } from './run-seats-wait.ts';

//region Translate lane re-seating
// SPLIT OUT OF `pass-entry.ts` for the file-length cap when the thirteenth
// class added it. The lanes phase seats both lanes at once, and the translate
// lane starts after the repair lane has spent minutes, which on 2026-09-07 was
// long enough for Hyper to be held out by its daily limit: every Hyper-only
// writer was refused in the same millisecond and the footnote passage the
// archive lacks stayed unfilled. So the translate lane asks for its seats
// again when it is about to start, through the same reader every phase uses,
// which waits out a named hold when the bench cannot reach quorum.

/**
 * Builds the re-seating the lanes driver calls when the translate lane is
 * about to start.
 *
 * @param client - run client whose dryness view and holds are the router's own
 *
 * @param signal - entry abort the reading honours
 *
 * @param entryId - entry the log line is tagged with
 *
 * @returns Reader of the translate lane's roster as of the moment it is called
 *
 * @example
 * ```ts
 * const reseatTranslate = translateReseatFor({ client, signal, entryId: entry.id, },);
 * ```
 */
export function translateReseatFor(
  {
    client,
    signal,
    entryId,
  }: {
    readonly client: RunClient;
    readonly signal: AbortSignal;
    readonly entryId: string;
  },
): () => Promise<TranslateModels> {
  return async function reseat(): Promise<TranslateModels> {
    /**
     * Benches as of the translate lane's start.
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
 * Which seat reading a lane's chunks wait on.
 */
const LANE_PHASE: Readonly<Record<'repair' | 'translate', JudgeSeatPhase>> = {
  repair: 'lanes',
  translate: 'translate lane',
};

/**
 * Hooks the lanes driver calls: the translate lane's re-seating when it is
 * about to start, and the wait each chunk of either lane takes before it
 * starts while a named hold keeps its bench from quorum.
 *
 * @example
 * ```ts
 * const hooks: LanesHooks = lanesHooksFor({ client, signal, entryId, },);
 * ```
 */
export type LanesHooks = {
  readonly reseatTranslate: () => Promise<TranslateModels>;
  readonly beforeSlice: (args: { readonly lane: 'repair' | 'translate'; },) => Promise<void>;
};

/**
 * Builds the hooks the lanes driver calls.
 *
 * @param client - run client whose dryness view and holds are the router's own
 *
 * @param signal - entry abort the readings honour
 *
 * @param entryId - entry the log lines are tagged with
 *
 * @returns Re-seating and per-chunk wait for both lanes
 *
 * @example
 * ```ts
 * const hooks = lanesHooksFor({ client, signal, entryId: entry.id, },);
 * ```
 */
export function lanesHooksFor(
  {
    client,
    signal,
    entryId,
  }: {
    readonly client: RunClient;
    readonly signal: AbortSignal;
    readonly entryId: string;
  },
): LanesHooks {
  return {
    reseatTranslate: translateReseatFor({
      client,
      signal,
      entryId,
    },),
    beforeSlice: async function beforeSlice(
      { lane, }: { readonly lane: 'repair' | 'translate'; },
    ): Promise<void> {
      await awaitBenchQuorum({
        client,
        phase: LANE_PHASE[lane],
        signal,
        l: tagged({ tag: entryId, },),
      },);
    },
  };
}

/**
 * Reads the lanes' benches and builds the lanes driver's hooks in one call,
 * so the pass entry names both in one place.
 *
 * The contest and the consolidation seams read their own benches: XIEPT2 on
 * 2026-09-03 ran Synthetic dry seven minutes into a 219-minute entry.
 *
 * @param client - run client whose dryness view and holds are the router's own
 *
 * @param signal - entry abort the readings honour
 *
 * @param entryId - entry the log lines are tagged with
 *
 * @returns Benches for both lanes as of now, and the hooks for when each
 * lane and chunk starts
 *
 * @example
 * ```ts
 * const { seats, lanesHooks, } = await readLanesSeats({ client, signal, entryId: entry.id, },);
 * ```
 */
export async function readLanesSeats(
  {
    client,
    signal,
    entryId,
  }: {
    readonly client: RunClient;
    readonly signal: AbortSignal;
    readonly entryId: string;
  },
): Promise<{
  readonly seats: JudgeSeats;
  readonly lanesHooks: LanesHooks;
}> {
  /**
   * Benches for both lanes as of now.
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
