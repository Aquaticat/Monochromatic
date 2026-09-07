import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { TranslateModels, } from '../translate-document-contract.ts';
import type { RunClient, } from './run-client-contract.ts';
import {
  type JudgeSeats,
  readJudgeSeats,
} from './run-seats.ts';

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
 * Reads the lanes' benches and builds the translate lane's re-seating in one
 * call, so the pass entry names both in one place.
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
 * @returns Benches for both lanes as of now, and the translate lane's
 * re-seating for when it starts
 *
 * @example
 * ```ts
 * const { seats, reseatTranslate, } = await readLanesSeats({ client, signal, entryId: entry.id, },);
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
  readonly reseatTranslate: () => Promise<TranslateModels>;
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
    reseatTranslate: translateReseatFor({
      client,
      signal,
      entryId,
    },),
  };
}

//endregion Translate lane re-seating
