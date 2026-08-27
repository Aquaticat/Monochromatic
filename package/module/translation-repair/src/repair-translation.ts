import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import {
  assessNonTranslationDominance,
  sliceAnchorsTranslation,
} from './non-translation-evidence.ts';
import { nonTranslationDominanceFinding, } from './non-translation-finding.ts';
import { mapOverlapped, } from './overlapped-map.ts';
import { assembleRepair, } from './repair-assemble.ts';
import type {
  ChunkRepairOutcome,
  RepairModels,
} from './repair-contract.ts';
import { refineSettledSlices, } from './repair-refine-step.ts';
import type { RepairTranslationResult, } from './repair-result.ts';
import { repairRunShape, } from './repair-slice-key.ts';
import { settleRepairSlice, } from './repair-slice-settle.ts';
import type { RefinedSliceSettlement, } from './refine-slice-settle.ts';
import { assertRostersConfigured, } from './roster-configuration.ts';
import type { SliceCache, } from './slice-cache.ts';
import type { TwinMemo, } from './twin-memo.ts';

export {
  type RepairStatus,
  type RepairTranslationResult,
} from './repair-result.ts';

//region Repair translation
// The batch driver over an already prepared document: every slice settles under
// bounded overlap, then dominance is reported, naturalness runs and final text
// is assembled. Everything degrades slice by slice, never document-wide.
//
// NOTHING BLOCKS THE DOCUMENT. Ensemble-agreed critical non-translation used
// to end the run and discard every slice already repaired. Question 3 answer B
// keeps critics as evidence and takes away every early return they owned. See
// `doc/decision/translation-repair-question-answers.md`.
//
// OVERLAP CHANGES WHEN INDEPENDENT SLICES RUN, NOT ARTIFACT ORDER. Each slice
// returns its outcome and driver finding as one settlement; `mapOverlapped`
// returns those settlements in slice order however providers answered.

/**
 * Logger root for repair pipeline.
 */
const l = tagged({ tag: 'translation-repair-pipeline', },);

/**
 * Default per-call deadline for pipeline exchanges.
 */
const DEFAULT_PIPELINE_CALL_TIMEOUT_MS = 300_000;

/**
 * Repairs one already prepared document pair.
 *
 * @param client - injected model client
 *
 * @param prepared - slices, governance, declared names and alignment findings
 *
 * @param models - repair role roster
 *
 * @param adjudicationConfig - tally thresholds and weights
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param sliceCache - optional cross-run cache for accuracy outcomes
 *
 * @param refineCache - optional cross-run cache for naturalness settlements
 *
 * @param overlap - most repair or refinement slices in flight; one reproduces former loops
 *
 * @param parentLogger - logger this lane tags under
 *
 * @returns Repaired candidate plus adjudicated issues and completion status
 *
 * @throws Whatever `signal.reason` carries once caller aborts with slices still
 * unbought; nothing settled under that abort is cached
 *
 * @example
 * ```ts
 * const result = await repairPreparedDocument({
 *   client,
 *   prepared,
 *   models,
 *   signal,
 *   overlap: 4,
 * },);
 * ```
 */
export async function repairPreparedDocument(
  {
    client,
    prepared,
    models,
    adjudicationConfig,
    signal,
    perCallTimeoutMs = DEFAULT_PIPELINE_CALL_TIMEOUT_MS,
    sliceCache,
    refineCache,
    overlap = 1,
    parentLogger = l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly prepared: PreparedDocumentPair;
    readonly models: RepairModels;
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs?: number;
    readonly sliceCache?: SliceCache<ChunkRepairOutcome>;
    readonly refineCache?: SliceCache<RefinedSliceSettlement>;
    readonly overlap?: number;
    readonly parentLogger?: Logger;
  }>,
): Promise<RepairTranslationResult> {
  // A fully cached document must not make invalid configuration valid. Refiner
  // stays absent because an empty refiner list deliberately turns that lane off.
  assertRostersConfigured({
    lane: 'repair',
    roles: {
      criticModelIds: models.criticModelIds,
      panelModelIds: models.panelModelIds,
      editorModelIds: models.editorModelIds,
      judgeModelIds: models.judgeModelIds,
      checkerModelIds: models.checkerModelIds,
    },
  },);

  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: repairPreparedDocument.name,
    l: parentLogger,
  },);

  /**
   * Translation under repair.
   */
  const { targetText, } = prepared;

  /**
   * Alignment findings in scorecard-stable wording.
   */
  const { alignmentFindings, } = prepared;

  /**
   * Paragraph-bound slice pairs in document order.
   */
  const { slices, } = prepared;

  /**
   * Slices governed by line-structure rule.
   */
  const lineStructuredSlices = prepared.lineStructuredSliceIndices;
  rl.info(
    `${String(prepared.alignmentPairCount,)} aligned units, ${
      String(slices.length,)
    } slices, ${String(alignmentFindings.length,)} alignment findings`,
  );

  /**
   * Identity context spread into run shape and naturalness call.
   */
  const identityFragment = (prepared.identityContext === undefined)
    ? {}
    : { identityContext: prepared.identityContext, };

  /**
   * Model-facing governance folded into every repair key.
   */
  const runShape = repairRunShape({
    models,
    ...((adjudicationConfig === undefined) ? {} : { adjudicationConfig, }),
    ...identityFragment,
  },);

  /**
   * Cache-eligible purchases in this run, shared by every slice.
   */
  const twins: TwinMemo<ChunkRepairOutcome> = new Map();

  /**
   * Every accuracy settlement, returned in slice order.
   */
  const settlements = await mapOverlapped({
    items: slices,
    overlap,
    oneItem: async function settleOne({
      item: slice,
      position: slicePosition,
    },) {
      return await settleRepairSlice({
        client,
        prepared,
        models,
        ...((adjudicationConfig === undefined) ? {} : { adjudicationConfig, }),
        slice,
        slicePosition,
        runShape,
        ...((sliceCache === undefined) ? {} : { sliceCache, }),
        twins,
        signal,
        perCallTimeoutMs,
        l: rl,
      },);
    },
  },);

  /**
   * Accuracy outcomes in document order.
   */
  const outcomes = settlements.map(function toOutcome(
    settlement,
  ): ChunkRepairOutcome {
    return settlement.outcome;
  },);

  /**
   * Cached outcomes refused for contradicting their text, in document order.
   */
  const refusedCacheFindings = settlements.flatMap(function toFindings(
    settlement,
  ): readonly string[] {
    return settlement.refusedCacheFindings;
  },);

  /**
   * Non-translation dominance over whole run, reported and never deciding.
   */
  const dominance = assessNonTranslationDominance({
    slices: slices.map(function toTally(
      sliceRef,
      slicePosition,
    ) {
      /**
       * This slice's settled outcome.
       */
      const sliceOutcome = outcomes[slicePosition];
      return {
        targetChars: sliceRef.target
          .text
          .length,
        votesStand: sliceOutcome?.nonTranslationStanding ?? false,
        anchorsTranslation: (sliceOutcome !== undefined)
          && sliceAnchorsTranslation({ outcome: sliceOutcome, },),
      };
    },),
  },);
  if (dominance.blocked) {
    rl.warn(
      `${nonTranslationDominanceFinding(dominance,)}; reported, not blocking`,
    );
  }

  /**
   * Dominance finding, present only when reading crossed.
   */
  const dominanceFindings = dominance.blocked
    ? [nonTranslationDominanceFinding(dominance,),]
    : [];

  /**
   * Naturalness lane over every accuracy-settled slice.
   */
  const phase = await refineSettledSlices({
    client,
    targetText,
    slices,
    outcomes,
    models,
    declaredNames: prepared.declaredNames,
    ...identityFragment,
    ...((refineCache === undefined) ? {} : { refineCache, }),
    signal,
    perCallTimeoutMs,
    overlap,
    l: rl,
  },);

  /**
   * Final outcomes after optional naturalness rewrites.
   */
  const finalOutcomes = phase.outcomes;

  return assembleRepair({
    targetText,
    slices,
    outcomes: finalOutcomes,
    lineStructuredSlices,
    findings: [
      ...alignmentFindings,
      ...refusedCacheFindings,
      ...dominanceFindings,
      ...finalOutcomes.flatMap(function toFindings(outcome,) {
        return outcome.findings;
      },),
      ...phase.findings,
    ],
    l: rl,
  },);
}

//endregion Repair translation
