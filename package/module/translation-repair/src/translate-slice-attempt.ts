import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { ChunkPair, } from './chunk-document.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import {
  TranslateAbsenceError,
  type TranslateAbsenceReason,
} from './translate-absence.ts';
import type {
  TranslateModels,
  TranslateSliceRecord,
} from './translate-document-contract.ts';
import { settleTranslateSlice, } from './translate-slice.ts';

//region Translate slice attempt
// One slice's round, with its two honest endings named.
//
// A slice either settles into a record or produces nothing to record, and the
// second is not a failure of the run: a passage the archive never translated,
// which this round could not translate either, leaves the document exactly as
// it found it. The driver has to tell those apart to know whether to cache, to
// splice, and what to say in its findings.
//
// SPLIT FROM THE DRIVER so the union has a home and the driver keeps its line
// budget for the loop it exists to run. What lives here is only the shape of
// one attempt; every decision about the document stays above.
//
// THE ABORT COMES FIRST, before the refusal. Under an abort every exchange is
// torn down and arrives as silence, so a slice with no incumbent reports
// exactly what a genuinely fruitless round reports. Blaming the models for a
// spent deadline would make an entry look unfillable when nothing was asked.

/**
 * What one slice's round produced.
 *
 * @example
 * ```ts
 * const attempt: SliceAttempt = { kind: 'settled', record, };
 * ```
 */
export type SliceAttempt = {
  /**
   * Round produced a record, whatever it decided.
   */
  readonly kind: 'settled';

  /**
   * That record.
   */
  readonly record: TranslateSliceRecord;
} | {
  /**
   * Slice has no translation in the archive and this round produced none, so
   * there is nothing to record and nothing to write.
   */
  readonly kind: 'unfilled';

  /**
   * Why nothing could be written.
   */
  readonly reason: TranslateAbsenceReason;

  /**
   * What the stage had gathered before it gave up.
   */
  readonly findings: readonly string[];
};

/**
 * Runs one slice and reports which of the two endings it reached.
 *
 * @param client - injected model client
 *
 * @param slice - prepared slice pair
 *
 * @param prepared - document the slice came from
 *
 * @param models - translator and judge rosters
 *
 * @param signal - entry abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - driver logger
 *
 * @returns Settled record, or the fact that this passage stays missing
 *
 * @throws Whatever the slice throws that is not an absence refusal, and the
 * caller's abort reason by identity when the signal fired
 *
 * @example
 * ```ts
 * const attempt = await attemptTranslateSlice({ client, slice, prepared, models, signal, ... },);
 * ```
 */
export async function attemptTranslateSlice(
  {
    client,
    slice,
    prepared,
    models,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly slice: ChunkPair;
    readonly prepared: PreparedDocumentPair;
    readonly models: TranslateModels;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<SliceAttempt> {
  try {
    return {
      kind: 'settled',
      record: await settleTranslateSlice({
        client,
        slice,
        prepared,
        models,
        signal,
        perCallTimeoutMs,
        l,
      },),
    };
  }
  catch (error) {
    // An aborted run fails BECAUSE it was aborted; whichever torn-down exchange
    // happened to surface is a symptom. The caller has to tell a spent deadline
    // apart from a provider fault by identity alone, and only one of those is
    // worth retrying the entry over.
    if (signal.aborted) {
      l.warn(
        `slice ${String(slice.target
          .chunkIndex,)}: abandoned by the caller's abort (${String(error,)})`,
      );
      throw signal.reason;
    }
    if (error instanceof TranslateAbsenceError) {
      return {
        kind: 'unfilled',
        reason: error.reason,
        findings: error.findings,
      };
    }
    throw error;
  }
}

//endregion Translate slice attempt
