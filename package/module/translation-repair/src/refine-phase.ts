import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { ChunkPair, } from './chunk-document.ts';
import { parseDocument, } from './parse-document.ts';
import {
  assertOverlap,
  mapOverlapped,
} from './overlapped-map.ts';
import {
  assertCheckerIndependence,
  assertCheckerQuorumReachable,
  type ChunkRepairOutcome,
  type RepairModels,
} from './repair-contract.ts';
import { repairReplacements, } from './repair-replacements.ts';
import { collectDefinitions, } from './refine-envelope.ts';
import { settleRefinePhaseSlice, } from './refine-phase-slice.ts';
import { refineRunShape, } from './refine-slice-key.ts';
import type { RefinedSliceSettlement, } from './refine-slice-settle.ts';
import type { SliceCache, } from './slice-cache.ts';
import { spliceSlices, } from './splice-slices.ts';

//region Refinement phase
// Naturalness is a second per-slice phase after every accuracy outcome settles.
// It stays outside `repairChunk`: accuracy exits early when no defect validates,
// while awkward but accurate text is this lane's primary input.
//
// THE PHASE CACHES ITS OWN QUESTIONS. Accuracy persists before naturalness runs,
// so sharing its cache would conflate two settlements and omitting this cache
// rebought every rewrite after an accuracy resume. Definitions from assembled
// accuracy text belong to every key because another slice can change references
// this slice's rewriter and guards resolve.
//
// OVERLAP CHANGES WHEN SLICES SETTLE, NEVER AGGREGATION ORDER. Settlements come
// back in outcome order, and `askedRewriters` is true when any freshly bought
// slice reached a rewriter. Resumed slices always report false for this run.

/**
 * Outcomes after refinement, with phase telemetry.
 *
 * @example
 * ```ts
 * const result: RefinePhaseResult = {
 *   outcomes,
 *   findings: [],
 *   askedRewriters: true,
 * };
 * ```
 */
export type RefinePhaseResult = {
  /**
   * Final per-slice outcomes in input order.
   */
  readonly outcomes: readonly ChunkRepairOutcome[];

  /**
   * Phase telemetry in input-slice order.
   */
  readonly findings: readonly string[];

  /**
   * Whether current run asked any rewriter rather than only resuming or finding
   * no eligible paragraph.
   */
  readonly askedRewriters: boolean;
};

/**
 * Runs naturalness lane over every accuracy-settled slice.
 *
 * @param client - injected model client
 *
 * @param targetText - archive translation used to assemble accuracy text
 *
 * @param slices - prepared pairs in document order
 *
 * @param outcomes - accuracy settlements in aggregation order
 *
 * @param models - role roster; absent refiners turn lane off
 *
 * @param identityContext - declared names and handles model prompts preserve
 *
 * @param declaredNames - exact declarations deterministic guard preserves
 *
 * @param refineCache - naturalness namespace for resume and persistence
 *
 * @param signal - caller abort honored by exchanges and persistence guard
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param overlap - most slices in flight; one reproduces former loop
 *
 * @param l - pipeline logger
 *
 * @returns Final outcomes, ordered findings, and current-run purchase signal
 *
 * @throws OverlapRefusedError when overlap is fractional or below one, even
 * when lane is configured off
 *
 * @throws UnpreparedSliceError when an outcome names no prepared slice
 *
 * @throws Whatever model, cache, or caller abort throws
 *
 * @example
 * ```ts
 * const phase = await runRefinePhase({
 *   client,
 *   targetText,
 *   slices,
 *   outcomes,
 *   models,
 *   declaredNames,
 *   signal,
 *   perCallTimeoutMs,
 *   overlap: 4,
 *   l,
 * },);
 * ```
 */
export async function runRefinePhase(
  {
    client,
    targetText,
    slices,
    outcomes,
    models,
    identityContext,
    declaredNames,
    refineCache,
    signal,
    perCallTimeoutMs,
    overlap = 1,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly targetText: string;
    readonly slices: readonly ChunkPair[];
    readonly outcomes: readonly ChunkRepairOutcome[];
    readonly models: RepairModels;
    readonly identityContext?: string;
    readonly declaredNames: readonly string[];
    readonly refineCache?: SliceCache<RefinedSliceSettlement>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly overlap?: number;
    readonly l: Logger;
  }>,
): Promise<RefinePhaseResult> {
  // A disabled lane must not make invalid caller configuration valid.
  assertOverlap({ overlap, },);

  /**
   * Rewriters, empty when lane is configured off.
   */
  const refinerModelIds = models.refinerModelIds ?? [];
  if (refinerModelIds.length === 0) {
    return {
      outcomes,
      findings: [],
      askedRewriters: false,
    };
  }

  assertCheckerIndependence({
    editorModelIds: models.editorModelIds,
    refinerModelIds,
    checkerModelIds: models.checkerModelIds,
    selfCertificationPermitted: models.checkerSelfCertificationPermitted ?? false,
  },);
  assertCheckerQuorumReachable({ checkerModelIds: models.checkerModelIds, },);

  /**
   * References from assembled accuracy text, shared by every slice question.
   */
  const definitions = collectDefinitions({
    document: parseDocument({
      text: spliceSlices({
        targetText,
        slices,
        replacements: repairReplacements({ outcomes, },),
      },),
    },),
  },);

  /**
   * Model-facing governance shared by every refinement key.
   */
  const runShape = refineRunShape({
    refinerModelIds,
    judgeModelIds: models.judgeModelIds,
    checkerModelIds: models.checkerModelIds,
    ...(identityContext === undefined ? {} : { identityContext, }),
  },);

  /**
   * Every refinement settlement in accuracy-outcome order.
   */
  const settlements = await mapOverlapped({
    items: outcomes,
    overlap,
    oneItem: async function settleOne({ item: outcome, },) {
      return await settleRefinePhaseSlice({
        client,
        outcome,
        slices,
        models,
        refinerModelIds,
        runShape,
        definitions,
        ...(identityContext === undefined ? {} : { identityContext, }),
        declaredNames,
        ...((refineCache === undefined) ? {} : { refineCache, }),
        signal,
        perCallTimeoutMs,
        l,
      },);
    },
  },);

  return {
    outcomes: settlements.map(function toOutcome(settlement,) {
      return settlement.outcome;
    },),
    findings: settlements.flatMap(function toFindings(settlement,) {
      return settlement.findings;
    },),
    askedRewriters: settlements.some(function askedThisRun(settlement,) {
      return settlement.asked;
    },),
  };
}

//endregion Refinement phase
