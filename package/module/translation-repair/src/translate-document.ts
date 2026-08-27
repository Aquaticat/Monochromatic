import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import type { PairedReading, } from './image-reading-pair.ts';
import { admitInsertions, } from './insertion-admission.ts';
import { mapOverlapped, } from './overlapped-map.ts';
import { assertRostersConfigured, } from './roster-configuration.ts';
import type { SliceCache, } from './slice-cache.ts';
import { assembleTranslation, } from './translate-assemble.ts';
import type {
  TranslateDocumentResult,
  TranslateModels,
  TranslateSliceRecord,
  UnfilledSlice,
} from './translate-document-contract.ts';
import { settleTranslateSlice, } from './translate-slice-settle.ts';
import { translateRunShape, } from './translate-slice-key.ts';
import type { TwinMemo, } from './twin-memo.ts';

//region Translate document
// The lane's document driver: every prepared slice is translated, judged, and
// settled into one record, and the accepted text is assembled back into a whole
// translation.
//
// EVERY SLICE, UNCONDITIONALLY. The repair driver returns early on several
// paths, and those paths are exactly the slices translation exists to recover:
// a fluent but mediocre translation that no critic complains about is never
// repaired and must still be translated. So nothing here decides whether a
// slice is worth visiting.
//
// A run that cannot finish THROWS rather than returning what it has. A result
// reporting unvisited slices as unchanged is indistinguishable from a document
// that needed no translation, and the settled slices are already in the cache
// for the next attempt.
//
// ONE EXCEPTION, and it is not an unvisited slice: a passage the archive never
// translated that this run could not translate either. Nothing was skipped
// there and nothing is claimed; the document keeps the gap it came with, the
// result says `unfilled` and names the passage, and the entry still settles so
// the rest of its slices keep what they cost.
//
// OVERLAP CHANGES WHEN INDEPENDENT SLICES RUN, NOT WHAT THE ARTIFACT SAYS.
// `mapOverlapped` returns settlements in slice order, and every finding comes
// back with its slice, so aggregation is byte-stable at any overlap. The twin
// memo coordinates identical questions already in flight and exposes only
// records the cache would expose to a warm run.

/**
 * Translates every slice of a prepared document pair and reassembles it.
 *
 * @param client - injected model client
 *
 * @param prepared - slices, governance and declared names, shared with any
 * other lane running over same document
 *
 * @param models - translator and judge rosters
 *
 * @param pictureReadings - what document pictures were read as
 *
 * @param signal - entry deadline and caller abort, honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param sliceCache - resumable per-slice cache, absent when caller wants no
 * resumption
 *
 * @param overlap - most slices in flight; one reproduces former sequential loop
 *
 * @param l - pipeline logger
 *
 * @returns Reassembled translation, its `status`, one settled record per
 * filled slice, and every passage this run left missing
 *
 * @throws {@link Error} when roster cannot seat a stage, overlap is invalid,
 * or caller aborts while this lane is buying
 *
 * @throws Whatever `signal.reason` carries once caller aborts with slices still
 * unbought; nothing settled under that abort is cached
 *
 * @example
 * ```ts
 * const result = await translateDocument({
 *   client,
 *   prepared,
 *   models,
 *   signal,
 *   perCallTimeoutMs,
 *   overlap: 4,
 *   l,
 * },);
 * ```
 */
export async function translateDocument(
  {
    client,
    prepared,
    models,
    pictureReadings = new Map(),
    signal,
    perCallTimeoutMs,
    sliceCache,
    overlap = 1,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly prepared: PreparedDocumentPair;
    readonly models: TranslateModels;
    readonly pictureReadings?: ReadonlyMap<string, PairedReading>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly sliceCache?: SliceCache<TranslateSliceRecord>;
    readonly overlap?: number;
    readonly l: Logger;
  }>,
): Promise<TranslateDocumentResult> {
  // FIRST, before run shape and cache lookup: a fully cached document must not
  // make an invalid configuration valid. A stage with nobody in it settles
  // exactly like one whose voices all failed, and only one is operator error.
  assertRostersConfigured({
    lane: 'translate',
    roles: {
      translatorModelIds: models.translatorModelIds,
      judgeModelIds: models.judgeModelIds,
    },
  },);

  /**
   * Logger tagged with this driver.
   */
  const tl = tagged({
    tag: translateDocument.name,
    l,
  },);

  /**
   * What this run asks, folded into every key.
   */
  const runShape = translateRunShape({
    models,
    ...((prepared.identityContext === undefined)
      ? {}
      : { identityContext: prepared.identityContext, }),
  },);

  /**
   * Slices with no translation beside them that page has room to be missing.
   *
   * Computed once because shortfall belongs to whole page rather than one
   * section, and spending it per section admits more than page is missing.
   */
  const admitted = admitInsertions({
    slices: prepared.slices,
    sourceText: prepared.sourceText,
    targetText: prepared.targetText,
  },);

  /**
   * Purchases in this run by shared key, exposing only persisted records.
   */
  const twins: TwinMemo<TranslateSliceRecord> = new Map();

  /**
   * Every slice's outcome and findings, returned in slice order.
   */
  const settlements = await mapOverlapped({
    items: prepared.slices,
    overlap,
    oneItem: async function settleOne({
      item: slice,
      position: slicePosition,
    },) {
      return await settleTranslateSlice({
        client,
        prepared,
        models,
        slice,
        slicePosition,
        insertionAdmitted: admitted.has(slicePosition,),
        pictureReadings,
        runShape,
        ...((sliceCache === undefined) ? {} : { sliceCache, }),
        twins,
        signal,
        perCallTimeoutMs,
        l: tl,
      },);
    },
  },);

  /**
   * Settled records in document order.
   */
  const settled = settlements.flatMap(function toSettled(
    { outcome, },
  ): readonly TranslateSliceRecord[] {
    return (outcome.kind === 'settled')
      ? [outcome.record,]
      : [];
  },);

  /**
   * Passages this run reached but left missing, in document order.
   */
  const unfilled = settlements.flatMap(function toUnfilled(
    { outcome, },
  ): readonly UnfilledSlice[] {
    return (outcome.kind === 'unfilled')
      ? [outcome.unfilled,]
      : [];
  },);

  /**
   * Slices recovered from disk, excluding twins reused within this run.
   */
  const resumedSliceCount = settlements
    .filter(function resumedFromDisk({ outcome, },): boolean {
      return (outcome.kind === 'settled') && outcome.resumedFromDisk;
    },)
    .length;

  /**
   * Cache refusals and unfilled evidence, grouped in document order.
   */
  const findings = settlements.flatMap(function toFindings(
    settlement,
  ): readonly string[] {
    return [
      ...settlement.refusedCacheFindings,
      ...settlement.unfilledFindings,
    ];
  },);

  return assembleTranslation({
    prepared,
    settled,
    unfilled,
    resumedSliceCount,
    findings,
    l: tl,
  },);
}

//endregion Translate document
