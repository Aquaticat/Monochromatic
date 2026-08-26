import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { ChunkPair, } from './chunk-document.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import type { SliceCache, } from './slice-cache.ts';
import { assertSettledRecordAgrees, } from './slice-record-agreement.ts';
import { absenceFinding, } from './translate-absence.ts';
import type {
  TranslateModels,
  TranslateSliceRecord,
  UnfilledSlice,
} from './translate-document-contract.ts';
import { attemptTranslateSlice, } from './translate-slice-attempt.ts';
import {
  assertUnheardKeptIncumbent,
  heardNobody,
} from './translate-unheard.ts';

//region Translate slice buy
// What one translate-lane slice costs when nothing can be reused: the stage
// call, the two agreement checks, and the persist that decides whether an
// in-run twin may reuse it.
//
// ITS OWN MODULE because `translate-slice-settle.ts` is at the line budget the
// repository sets, and this is the half with a boundary of its own: everything
// here happens only when the slice is bought, and everything there decides
// whether it is.

/**
 * What one purchase returned, and whether it was stored.
 */
export type BoughtSlice = {
  readonly kind: 'settled';
  readonly record: TranslateSliceRecord;

  /**
   * Whether the record reached the cache, which is what a twin may reuse.
   */
  readonly persisted: boolean;
} | {
  readonly kind: 'unfilled';
  readonly unfilled: UnfilledSlice;
  readonly findings: readonly string[];
};

/**
 * Buys one slice: translated, judged, checked, and persisted when somebody
 * was heard.
 *
 * @param client - injected model client
 *
 * @param slice - slice to buy
 *
 * @param prepared - document the slice belongs to
 *
 * @param models - translator and judge rosters
 *
 * @param key - cross-run key the record is persisted under
 *
 * @param neighbouringIncumbentText - archive English either side
 *
 * @param neighbouringSourceText - original either side
 *
 * @param pictureContext - what nearby pictures were read as
 *
 * @param pictureFindings - which nearby pictures nobody could read
 *
 * @param sliceCache - where a heard record is persisted
 *
 * @param signal - entry deadline and caller abort
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - lane logger
 *
 * @returns Purchase, stored or not
 *
 * @throws Whatever `signal.reason` carries, when the caller aborted before or
 * during the purchase; nothing settled under that abort is cached
 *
 * @example
 * ```ts
 * const bought = await buyTranslateSlice({ ... },);
 * ```
 */
export async function buyTranslateSlice(
  {
    client,
    slice,
    prepared,
    models,
    key,
    neighbouringIncumbentText,
    neighbouringSourceText,
    pictureContext,
    pictureFindings,
    sliceCache,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly slice: ChunkPair;
    readonly prepared: PreparedDocumentPair;
    readonly models: TranslateModels;
    readonly key: string;
    readonly neighbouringIncumbentText: string;
    readonly neighbouringSourceText: string;
    readonly pictureContext: string;
    readonly pictureFindings: readonly string[];
    readonly sliceCache?: SliceCache<TranslateSliceRecord>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<BoughtSlice> {
  /**
   * Global index of this slice, which every record names.
   */
  const { sliceIndex, } = slice.target;

  // Checked here rather than before the cache lookup, so a document whose
  // every slice is already cached still finishes: what a stopped run cannot
  // do is BUY the slices it is missing. A twin that waited on another's
  // purchase is checked afresh on waking.
  signal.throwIfAborted();

  /**
   * Fresh record for this slice, translated and judged.
   */
  const attempt = await attemptTranslateSlice({
    client,
    slice,
    prepared,
    models,
    neighbouringIncumbentText,
    neighbouringSourceText,
    pictureContext,
    pictureFindings,
    signal,
    perCallTimeoutMs,
    l,
  },);

  // A run stopped part way through a slice does NOT fail loudly on its own:
  // every abandoned exchange reaches the stage as silence, and a stage that
  // heard nothing keeps the incumbent and reports a settled slice. Caching
  // that would record the collapse as finished work, and every later attempt
  // would resume it rather than ask again.
  signal.throwIfAborted();
  if (attempt.kind === 'unfilled') {
    // ONE SLICE RATHER THAN THE ENTRY. The archive has no wording here, so
    // there is nothing to fall back on and nothing to write; what the
    // document keeps is the gap it already had. Every other slice is still
    // worth what it cost, and the next run asks again, because nothing is
    // cached for a slice that produced nothing.
    l.warn(
      `slice ${String(sliceIndex,)}: no translation in the archive and none produced (${
        attempt.reason
      }); the passage stays missing and the slice is NOT cached`,
    );
    return {
      kind: 'unfilled',
      unfilled: {
        sliceIndex,
        reason: attempt.reason,
        findings: attempt.findings,
      },
      findings: [
        ...attempt.findings,
        `${absenceFinding({ reason: attempt.reason, },)} chunk ${String(sliceIndex,)}`,
      ],
    };
  }

  /**
   * Record this round settled.
   */
  const { record, } = attempt;

  // Checked on the way OUT of the stage as well as on the way back in from
  // the cache, and before the write either way, so nothing contradicting
  // itself is ever stored. The stage derives `changed` from its own text
  // today, which makes this vacuous by construction; what it pins is that it
  // keeps doing so.
  assertSettledRecordAgrees({
    lane: 'translate',
    sliceIndex,
    changed: record.changed,
    decidedText: record.outputText,
    incumbentText: slice.target
      .text,
  },);
  // WHAT HEARING NOBODY HAS TO MEAN, checked before the record is kept. The
  // branch below rests on it, and so does every wording built from this
  // record afterwards.
  assertUnheardKeptIncumbent({
    sliceIndex,
    record,
    incumbentText: slice.target
      .text,
  },);
  if (heardNobody({ record, },)) {
    l.warn(
      `slice ${String(sliceIndex,)}: no translator was heard, so the incumbent `
        + 'stands for this run and the slice is NOT cached',
    );
    return {
      kind: 'settled',
      record,
      persisted: false,
    };
  }
  await sliceCache?.persist({
    key,
    serialized: JSON.stringify(
      record,
      undefined,
      2,
    ),
  },);
  // MEMOIZED EXACTLY WHERE IT IS PERSISTED, which is the point of the
  // memoization: a warm run can only resume what reached the cache, so an
  // in-run twin must reuse only what a warm run would have found. Reported as
  // persisted whether or not a cache was handed in, since the memo is about
  // what WOULD resume.
  return {
    kind: 'settled',
    record,
    persisted: true,
  };
}


//endregion Translate slice buy
