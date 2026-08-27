import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import {
  neighbouringIncumbent,
  neighbouringSource,
} from './fidelity-window.ts';
import { cacheRefusalsOf, } from './repair-cache-gate.ts';
import type {
  ChunkRepairOutcome,
  RepairModels,
} from './repair-contract.ts';
import { notApplicableRepair, } from './repair-not-applicable.ts';
import { buyRepairSlice, } from './repair-slice-buy.ts';
import { repairSliceKey, } from './repair-slice-key.ts';
import type { SliceCache, } from './slice-cache.ts';
import { armSliceCost, } from './slice-cost-log.ts';
import {
  resumedSliceDiscardFinding,
  sliceRecordAgrees,
} from './slice-record-agreement.ts';
import {
  reuseTwinOrBuy,
  type TwinMemo,
  type TwinStored,
} from './twin-memo.ts';

//region Repair slice settle
// One prepared repair slice from neighbour windows to a resumed, twin-reused or
// freshly bought outcome. Every finding generated outside `repairChunk` comes
// back with its slice so the document driver can aggregate in slice order.
//
// A REFUSED CACHE RECORD NOW REACHES THE MEMO, matching the translate lane and
// a warm run: after refusal, one twin buys; another reuses only if that buy was
// eligible for persistence. The old sequential body bypassed its in-run map on
// this path and could buy two answers under one key, while the next warm run
// resumed one. That disagreement is corrected deliberately.

/**
 * What one slice settled to beside cache records it refused.
 */
export type RepairSliceSettlement = {
  /**
   * Outcome this slice contributes to dominance, refinement and assembly.
   */
  readonly outcome: ChunkRepairOutcome;

  /**
   * Cached outcomes refused for contradicting their own text.
   */
  readonly refusedCacheFindings: readonly string[];
};

/**
 * Reads what purchase leaves for twins using same predicate as cache gate.
 *
 * @param outcome - purchase to classify
 *
 * @returns Stored outcome only when warm run could resume it
 *
 * @example
 * ```ts
 * const stored = storedOutcome(outcome,);
 * ```
 */
function storedOutcome(
  outcome: ChunkRepairOutcome,
): TwinStored<ChunkRepairOutcome> {
  return (cacheRefusalsOf({ outcome, },).length === 0)
    ? {
      kind: 'stored',
      record: outcome,
    }
    : { kind: 'nothing', };
}

/**
 * Settles one repair slice from cache, twin memo or fresh purchase.
 *
 * @param client - injected model client
 *
 * @param prepared - document slice belongs to
 *
 * @param models - repair role roster
 *
 * @param adjudicationConfig - tally thresholds and weights
 *
 * @param slice - slice being settled
 *
 * @param slicePosition - position in prepared slice array
 *
 * @param runShape - model-facing governance folded into cache key
 *
 * @param sliceCache - optional cross-run cache
 *
 * @param twins - shared memo of cache-eligible purchases in this run
 *
 * @param signal - entry deadline and caller abort
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - repair-lane logger
 *
 * @returns Outcome and cache-refusal findings
 *
 * @throws Whatever `signal.reason` carries when caller aborts with this slice
 * still unbought
 *
 * @example
 * ```ts
 * const settlement = await settleRepairSlice({ ..., slicePosition: 0, });
 * ```
 */
export async function settleRepairSlice(
  {
    client,
    prepared,
    models,
    adjudicationConfig,
    slice,
    slicePosition,
    runShape,
    sliceCache,
    twins,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly prepared: PreparedDocumentPair;
    readonly models: RepairModels;
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly slice: ChunkPair;
    readonly slicePosition: number;
    readonly runShape: string;
    readonly sliceCache?: SliceCache<ChunkRepairOutcome>;
    readonly twins: TwinMemo<ChunkRepairOutcome>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<RepairSliceSettlement> {
  /**
   * Global index every outcome and replacement names.
   */
  const { sliceIndex, } = slice.target;

  /**
   * Original of adjacent passages, addressed by position rather than stamp.
   */
  const neighbouringSourceText = neighbouringSource({
    slices: prepared.slices,
    slicePosition,
  },);

  /**
   * Archive English of adjacent passages.
   */
  const neighbouringIncumbentText = neighbouringIncumbent({
    slices: prepared.slices,
    slicePosition,
  },);

  /**
   * What this slice cost, reported however this function is left.
   */
  using cost = armSliceCost({
    l,
    lane: 'repair',
    sliceIndex,
    sourceChars: slice.source
      .text
      .length,
    signal,
  },);

  if (isInsertionChunk(slice.target,)) {
    l.info(
      `chunk ${String(sliceIndex,)}: no translation to repair; `
        + 'the translate lane owns this passage',
    );
    cost.left({ exit: 'no-translation', },);
    return {
      outcome: notApplicableRepair({ sliceIndex, },),
      refusedCacheFindings: [],
    };
  }

  /**
   * Cross-run key for this slice.
   */
  const key = repairSliceKey({
    runShape,
    sourceText: slice.source
      .text,
    targetText: slice.target
      .text,
    lineStructured: prepared.lineStructuredSliceIndices
      .has(sliceIndex,),
    neighbouringIncumbentText,
    neighbouringSourceText,
  },);

  /**
   * Outcome an earlier run stored for this question.
   */
  const stored = sliceCache?.resumed
    .get(key,);

  /**
   * Disk outcome restamped for this slice's position.
   */
  const cached = (stored === undefined) ? undefined : {
    ...stored,
    sliceIndex,
  };

  /**
   * Findings explaining why disk outcome was refused.
   */
  const refusedCacheFindings: string[] = [];
  if (cached !== undefined) {
    if (sliceRecordAgrees({
      changed: cached.changed,
      decidedText: cached.repairedText,
      incumbentText: slice.target
        .text,
    },)) {
      cost.left({ exit: 'resumed', },);
      return {
        outcome: cached,
        refusedCacheFindings,
      };
    }

    /**
     * Why this slice is recomputed rather than resumed.
     */
    const discarded = resumedSliceDiscardFinding({
      lane: 'repair',
      sliceIndex,
      changed: cached.changed,
    },);
    l.warn(discarded,);
    refusedCacheFindings.push(discarded,);
  }

  /**
   * Twin's eligible outcome, or this slice's own purchase.
   */
  const asked = await reuseTwinOrBuy({
    key,
    memo: twins,
    buy: async function buyThisSlice(): Promise<ChunkRepairOutcome> {
      return await buyRepairSlice({
        client,
        prepared,
        models,
        ...((adjudicationConfig === undefined) ? {} : { adjudicationConfig, }),
        slice,
        key,
        neighbouringIncumbentText,
        neighbouringSourceText,
        ...((sliceCache === undefined) ? {} : { sliceCache, }),
        signal,
        perCallTimeoutMs,
        l,
      },);
    },
    persistedOf: storedOutcome,
    l,
  },);
  if (asked.kind === 'reused') {
    cost.left({ exit: 'resumed', },);
    return {
      outcome: {
        ...asked.twin,
        sliceIndex,
      },
      refusedCacheFindings,
    };
  }

  return {
    outcome: asked.bought,
    refusedCacheFindings,
  };
}

//endregion Repair slice settle
