import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import {
  neighbouringIncumbent,
  neighbouringSource,
} from './fidelity-window.ts';
import type { PairedReading, } from './image-reading-pair.ts';
import type { SliceCache, } from './slice-cache.ts';
import { armSliceCost, } from './slice-cost-log.ts';
import { slicePictures, } from './slice-pictures.ts';
import {
  resumedSliceDiscardFinding,
  sliceRecordAgrees,
} from './slice-record-agreement.ts';
import {
  absenceFinding,
  type IncumbentKind,
} from './translate-absence.ts';
import type {
  TranslateModels,
  TranslateSliceRecord,
  UnfilledSlice,
} from './translate-document-contract.ts';
import {
  type BoughtSlice,
  buyTranslateSlice,
} from './translate-slice-buy.ts';
import { translateSliceKey, } from './translate-slice-key.ts';
import {
  heardNobody,
  unheardCacheDiscardFinding,
} from './translate-unheard.ts';
import {
  reuseTwinOrBuy,
  type TwinMemo,
  type TwinStored,
} from './twin-memo.ts';

//region Translate slice settle
// One slice of the translate lane, from its window to its settled record: the
// body `translateDocument` used to run in a loop, moved out so the driver can
// run it under `mapOverlapped` with any number in flight.
//
// EVERYTHING A SLICE REPORTS COMES BACK WITH IT rather than being pushed onto
// a shared list, because under overlap the slices finish in whatever order the
// providers answer, and a shared list would put findings into the artifact in
// that order. The driver aggregates in slice order, so the artifact reads the
// same at any overlap.
//
// THE IN-RUN TWIN MEMO IS A PROMISE MAP now (`twin-memo.ts`), for the reason
// given there. ONE PATH CHANGED WITH IT, and deliberately: a slice whose
// cached record was refused used to buy without consulting the memo, so two
// twins with the same refused record each bought and each persisted under one
// key, and the next warm run resumed a single record for both. Both twins now
// reach the memo after refusing the cache, so the second reuses what the first
// persisted, which is what the warm run does.

/**
 * Reads what a purchase left for its twins: a record only where the lane
 * persisted one, since an in-run twin may reuse only what a warm run would
 * have resumed.
 *
 * AT MODULE SCOPE because it closes over nothing, which is also what makes it
 * readable: the rule it states is about purchases in general, not about the
 * slice being settled.
 *
 * @param bought - purchase to read
 *
 * @returns Record when it was persisted
 *
 * @example
 * ```ts
 * const stored = storedRecord({ kind: 'settled', record, persisted: true, },);
 * ```
 */
function storedRecord(bought: BoughtSlice,): TwinStored<TranslateSliceRecord> {
  return ((bought.kind === 'settled') && bought.persisted)
    ? {
      kind: 'stored',
      record: bought.record,
    }
    : { kind: 'nothing', };
}

/**
 * What one slice settled to.
 */
export type TranslateSliceOutcome = {
  readonly kind: 'settled';

  /**
   * Record for this slice, stamped with its own index.
   */
  readonly record: TranslateSliceRecord;

  /**
   * Whether the record came off disk, which is what the resumed count
   * reports. A twin's record settled in this run does not count: nothing was
   * recovered from disk, and counting it would overstate what resumption buys.
   */
  readonly resumedFromDisk: boolean;
} | {
  readonly kind: 'unfilled';

  /**
   * Passage this run left missing, and why.
   */
  readonly unfilled: UnfilledSlice;
};

/**
 * One slice's outcome beside what it reported on the way.
 */
export type TranslateSliceSettlement = {
  readonly outcome: TranslateSliceOutcome;

  /**
   * Cached records refused for contradicting themselves or for having heard
   * nobody, so a recomputed slice is distinguishable from a never-cached one.
   */
  readonly refusedCacheFindings: readonly string[];

  /**
   * What an unfilled slice reported before giving up, plus one sentence
   * naming it; empty for a settled slice.
   */
  readonly unfilledFindings: readonly string[];
};

/**
 * Settles one slice of the translate lane: resumed from disk, reused from a
 * twin, or bought.
 *
 * @param client - injected model client
 *
 * @param prepared - slices, governance and declared names
 *
 * @param models - translator and judge rosters
 *
 * @param slice - slice to settle
 *
 * @param slicePosition - where it sits in `prepared.slices`, which the window
 * is addressed by
 *
 * @param insertionAdmitted - whether, for an original with no translation
 * beside it, the page has room to be missing it
 *
 * @param pictureReadings - what the document's pictures were read as
 *
 * @param runShape - what this run asks, folded into the key
 *
 * @param sliceCache - resumable per-slice cache, absent when a caller wants no
 * resumption
 *
 * @param twins - memo of purchases in this run, shared by every slice
 *
 * @param signal - entry deadline and caller abort
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - lane logger
 *
 * @returns Outcome beside what the slice reported
 *
 * @throws Whatever `signal.reason` carries, once the caller aborts with this
 * slice still unbought
 *
 * @example
 * ```ts
 * const settlement = await settleTranslateSlice({ ..., slice, slicePosition: 0, },);
 * ```
 */
export async function settleTranslateSlice(
  {
    client,
    prepared,
    models,
    slice,
    slicePosition,
    insertionAdmitted,
    pictureReadings,
    runShape,
    sliceCache,
    twins,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly prepared: PreparedDocumentPair;
    readonly models: TranslateModels;
    readonly slice: ChunkPair;
    readonly slicePosition: number;
    readonly insertionAdmitted: boolean;
    readonly pictureReadings: ReadonlyMap<string, PairedReading>;
    readonly runShape: string;
    readonly sliceCache?: SliceCache<TranslateSliceRecord>;
    readonly twins: TwinMemo<TranslateSliceRecord>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<TranslateSliceSettlement> {
  /**
   * Global index of this slice, which every record and replacement names.
   */
  const { sliceIndex, } = slice.target;

  if (isInsertionChunk(slice.target,) && (!insertionAdmitted)) {
    // NOTHING IS BOUGHT HERE. The pairing says this original went unrendered,
    // but the page carries at least as much English as its source predicts, so
    // the likelier reading is that the passage was merged into a neighbour and
    // writing it in would put a second rendering of it into the document.
    l.warn(
      `slice ${String(sliceIndex,)}: an original with no translation beside it, but the page `
        + 'has no room to be missing it; nothing was bought and the passage stays as it is',
    );
    return {
      outcome: {
        kind: 'unfilled',
        unfilled: {
          sliceIndex,
          reason: 'not-corroborated',
          findings: [],
        },
      },
      refusedCacheFindings: [],
      unfilledFindings: [
        `${absenceFinding({ reason: 'not-corroborated', },)} chunk ${String(sliceIndex,)}`,
      ],
    };
  }

  /**
   * What this slice cost, reported however this function is left.
   */
  using cost = armSliceCost({
    l,
    lane: 'translate',
    sliceIndex,
    sourceChars: slice.source
      .text
      .length,
    signal,
  },);

  /**
   * Whether the archive holds a translation for this slice at all, which
   * decides both what its key answers and what a fruitless round means.
   */
  const incumbentKind: IncumbentKind = isInsertionChunk(slice.target,)
    ? 'absent'
    : 'present';

  /**
   * Original of the passages either side.
   *
   * COMPUTED HERE RATHER THAN INSIDE THE ATTEMPT, so the cache key and the
   * call are provably given the same window. A key that did not name the
   * evidence would let a narrow run's answer be resumed for a wide one.
   */
  const neighbouringSourceText = neighbouringSource({
    slices: prepared.slices,
    slicePosition,
  },);

  /**
   * What the pictures this slice and its neighbours show were read as, and
   * which of them nobody could read. One value feeds both the key and the
   * call, for the same reason the window does (`#107`).
   */
  const pictures = slicePictures({
    slices: prepared.slices,
    slicePosition,
    readings: pictureReadings,
  },);

  /**
   * Archive English of the passages either side, which is the half that shows
   * a relocation.
   */
  const neighbouringIncumbentText = neighbouringIncumbent({
    slices: prepared.slices,
    slicePosition,
  },);

  /**
   * Cross-run key for it.
   */
  const key = translateSliceKey({
    runShape,
    sourceText: slice.source
      .text,
    incumbentText: slice.target
      .text,
    incumbentKind,
    ...((slice.syntax === undefined) ? {} : { syntax: slice.syntax, }),
    lineStructured: prepared.lineStructuredSliceIndices
      .has(sliceIndex,),
    neighbouringIncumbentText,
    neighbouringSourceText,
    pictureContext: pictures.context,
  },);

  /**
   * Record an earlier RUN settled for this question.
   */
  const cached = sliceCache?.resumed
    .get(key,);

  /**
   * Why a cached record was not resumed, empty when none was refused.
   */
  const refusedCacheFindings: string[] = [];
  if (cached !== undefined) {
    // NEVER WRITTEN BY THIS LANE, which refuses to cache a slice no translator
    // answered for. One in the cache came from an older build, and resuming
    // it would settle a slice that reports the archive standing by default
    // without anybody having asked again.
    if (heardNobody({ record: cached, },)) {
      /**
       * Why this slice is being asked again rather than resumed.
       */
      const unheard = unheardCacheDiscardFinding({ sliceIndex, },);
      l.warn(unheard,);
      refusedCacheFindings.push(unheard,);
    }
    else if (sliceRecordAgrees({
      changed: cached.changed,
      decidedText: cached.outputText,
      incumbentText: slice.target
        .text,
    },)) {
      cost.left({ exit: 'resumed', },);
      // RE-STAMPED with the index this run asked under, rather than trusting
      // the one the record was computed with: an identical slice sitting
      // elsewhere in the document legitimately answers here.
      return {
        outcome: {
          kind: 'settled',
          record: {
            ...cached,
            sliceIndex,
          },
          resumedFromDisk: true,
        },
        refusedCacheFindings: [],
        unfilledFindings: [],
      };
    }

    /**
     * Why this slice was recomputed, which a cache miss would not explain.
     */
    const discarded = resumedSliceDiscardFinding({
      lane: 'translate',
      sliceIndex,
      changed: cached.changed,
    },);
    l.warn(discarded,);
    refusedCacheFindings.push(discarded,);
  }

  /**
   * A twin's stored record, or this slice's own purchase.
   */
  const asked = await reuseTwinOrBuy({
    key,
    memo: twins,
    buy: async function buyThisSlice(): Promise<BoughtSlice> {
      return await buyTranslateSlice({
        client,
        slice,
        prepared,
        models,
        key,
        neighbouringIncumbentText,
        neighbouringSourceText,
        pictureContext: pictures.context,
        pictureFindings: pictures.findings,
        ...((sliceCache === undefined) ? {} : { sliceCache, }),
        signal,
        perCallTimeoutMs,
        l,
      },);
    },
    persistedOf: storedRecord,
    l,
  },);
  if (asked.kind === 'reused') {
    cost.left({ exit: 'resumed', },);
    return {
      outcome: {
        kind: 'settled',
        record: {
          ...asked.twin,
          sliceIndex,
        },
        resumedFromDisk: false,
      },
      refusedCacheFindings,
      unfilledFindings: [],
    };
  }

  /**
   * This slice's own purchase.
   */
  const { bought, } = asked;
  if (bought.kind === 'unfilled') {
    cost.left({ exit: 'unfilled', },);
    return {
      outcome: {
        kind: 'unfilled',
        unfilled: bought.unfilled,
      },
      refusedCacheFindings,
      unfilledFindings: bought.findings,
    };
  }
  return {
    outcome: {
      kind: 'settled',
      record: bought.record,
      resumedFromDisk: false,
    },
    refusedCacheFindings,
    unfilledFindings: [],
  };
}

//endregion Translate slice settle
