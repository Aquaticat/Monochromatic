import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import {
  type PreparedDocumentPair,
  prepareDocumentPair,
} from './document-preparation.ts';
import {
  assessNonTranslationDominance,
  sliceAnchorsTranslation,
} from './non-translation-evidence.ts';
import { buildLaneSliceTexts, } from './lane-slice-text.ts';
import { SLICE_CHAR_BUDGET, } from './slice-pair.ts';
import { runRefinePhase, } from './refine-phase.ts';
import {
  repairRunShape,
  repairSliceKey,
} from './repair-slice-key.ts';
import {
  resumedSliceAgrees,
  resumedSliceDiscardFinding,
} from './resumed-slice.ts';
import { blockedRepairResult, } from './repair-blocked-exit.ts';
import { repairChunk, } from './repair-chunk.ts';
import { assertRostersConfigured, } from './roster-configuration.ts';
import {
  buildChunkCriticRecords,
  type ChunkCriticRecord,
} from './critic-attribution.ts';
import {
  buildIssueRecords,
  type RepairIssueRecord,
} from './repair-record.ts';
import { repairReplacements, } from './repair-replacements.ts';
import type { SliceCache, } from './slice-cache.ts';
import { assembleRepair, } from './repair-assemble.ts';
import type { RepairTranslationResult, } from './repair-result.ts';
import type {
  ChunkRepairOutcome,
  RepairModels,
} from './repair-contract.ts';

export {
  type RepairStatus,
  type RepairTranslationResult,
} from './repair-result.ts';

//region Repair translation
// The batch driver over the whole loop: parse, align into chunk pairs, run
// each pair through the repair stages, splice winning chunks back into the
// document. Ensemble-agreed critical non-translation blocks repair and
// returns the input unchanged (settled architecture) unless deterministic
// evidence contradicts the votes (see non-translation-evidence.ts);
// everything else degrades chunk by chunk, never document-wide.

/**
 * Logger root for the repair pipeline.
 */
const l = tagged({ tag: 'translation-repair-pipeline', },);

/**
 * Default per-call deadline for pipeline exchanges;
 * chunk-scale calls complete in well under this.
 */
const DEFAULT_PIPELINE_CALL_TIMEOUT_MS = 300_000;


/**
 * Repairs one ALREADY PREPARED document pair.
 * Stages are pure `(state, responses) -> newState`; this driver is the
 * imperative shell that owns model calls, chunk order, and reassembly.
 * Chunks run sequentially because aggregate concurrency beyond one stream
 * per model collapses throughput on this plan, and each stage already fans
 * out one call per model inside the chunk.
 *
 * Takes the preparation rather than the two texts, so a caller running both
 * lanes over one document prepares ONCE and hands the same slices to each. Two
 * lanes preparing separately would drift the moment either changed a budget,
 * and each would still report slices that look right on their own.
 *
 * @param client - injected model client
 *
 * @param prepared - slices, governance, declared names and alignment findings,
 * from `prepareDocumentPair`
 *
 * @param models - role roster
 *
 * @param adjudicationConfig - tally thresholds and weights
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param sliceCache - optional cross-run cache; resumes finished slices
 * and persists newly finished ones so a large document survives aborts
 *
 * @param parentLogger - logger this lane tags under, so a caller running both
 * lanes over one document can put them under one entry; defaults to the
 * pipeline root for a standalone call
 *
 * @returns Repaired candidate plus adjudicated issues and completion status
 *
 * @throws Whatever `signal.reason` carries, once the caller aborts with slices
 * still unbought; nothing settled under that abort is cached
 *
 * @example
 * ```ts
 * const result = await repairPreparedDocument({
 *   client,
 *   prepared,
 *   models,
 *   signal,
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
    parentLogger = l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly prepared: PreparedDocumentPair;
    readonly models: RepairModels;
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs?: number;
    readonly sliceCache?: SliceCache<ChunkRepairOutcome>;
    readonly parentLogger?: Logger;
  }>,
): Promise<RepairTranslationResult> {
  // FIRST, before the run shape, before the cache lookup, before any slice
  // work: a fully cached document must not make an invalid configuration
  // valid. Placed HERE rather than in `repairTranslation`, because the combined
  // driver calls this function directly and a check one level up is bypassed.
  //
  // CRITICS ARE ABSENT FROM THIS LIST ON PURPOSE. Question 3 may drop the
  // critic stage from this path outright, which would make an empty critic
  // roster the INTENDED configuration; guarding it now would refuse a shape the
  // user may be about to choose. `#93` carries that, and `refinerModelIds` is
  // absent for a settled reason instead: its empty list is how the naturalness
  // lane is turned off.
  assertRostersConfigured({
    lane: 'repair',
    roles: {
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
   * Translation under repair, which every unchanged path returns and which
   * assembly splices into.
   */
  const { targetText, } = prepared;

  /**
   * Identity block spread into the chunk call, omitted entirely when nothing
   * is declared so the prompt never carries an empty heading.
   */
  const identityFragment = prepared.identityContext === undefined
    ? {}
    : { identityContext: prepared.identityContext, };

  /**
   * Alignment findings in scorecard-stable wording.
   */
  const { alignmentFindings, } = prepared;

  /**
   * Paragraph-bound slice pairs across every aligned section, indexed globally
   * in document order.
   */
  const { slices, } = prepared;

  /**
   * Slices the line-structure rule governs, inherited from their chunk.
   */
  const lineStructuredSlices = prepared.lineStructuredSliceIndices;
  rl.info(
    `${String(prepared.alignmentPairCount,)} chunk pairs, ${
      String(slices.length,)
    } slices, ${String(alignmentFindings.length,)} alignment findings`,
  );

  /**
   * Everything about this run that changes what the models are ASKED, folded
   * into every cache key.
   */
  const runShape = repairRunShape({
    models,
    ...(adjudicationConfig === undefined ? {} : { adjudicationConfig, }),
    ...identityFragment,
  },);

  /**
   * Slice outcomes in document order; sequential by design (see TSDoc).
   */
  const outcomes: ChunkRepairOutcome[] = [];

  /**
   * Cached outcomes refused for contradicting themselves, named in the result
   * so a recomputed slice is distinguishable from one that was never cached.
   */
  const refusedCacheFindings: string[] = [];
  for (const slice of slices) {
    /**
     * Global index of this slice, which every key and every outcome names.
     */
    const { chunkIndex, } = slice.target;

    /**
     * Cross-run key for this slice.
     */
    const sliceKey = repairSliceKey({
      runShape,
      chunkIndex,
      sourceText: slice.source
        .text,
      targetText: slice.target
        .text,
      lineStructured: lineStructuredSlices.has(chunkIndex,),
    },);

    /**
     * Outcome finished on an earlier run, when this slice is cached.
     */
    const cached = sliceCache?.resumed
      .get(sliceKey,);
    if ((cached !== undefined) && (cached.chunkIndex !== chunkIndex)) {
      throw new Error(
        `cached repair slice ${String(cached.chunkIndex,)} was loaded for slice `
          + `${String(chunkIndex,)}: the key derivation and the slicing `
          + 'disagree, so every resumed outcome is suspect',
      );
    }

    /**
     * Whether that outcome's changed flag agrees with its own text, which is
     * the one thing a cached record can be checked against without asking
     * anybody. A record that disagrees is refused HERE rather than at assembly,
     * where the same contradiction fails the whole document after every other
     * slice has been bought.
     */
    const trustworthy = (cached === undefined)
      || resumedSliceAgrees({
        changed: cached.changed,
        decidedText: cached.repairedText,
        incumbentText: slice.target
          .text,
      },);
    if ((cached !== undefined) && (!trustworthy)) {
      /**
       * Why this slice was recomputed, which a cache miss would not explain.
       */
      const discarded = resumedSliceDiscardFinding({
        lane: 'repair',
        chunkIndex,
        changed: cached.changed,
      },);
      rl.warn(discarded,);
      refusedCacheFindings.push(discarded,);
    }

    /**
     * Outcome this run may reuse, absent when there is none to reuse.
     */
    const resumed = trustworthy ? cached : undefined;

    // A stopped run cannot BUY the slices it is missing, and every abandoned
    // exchange reaches the stages as silence rather than as a failure: a critic
    // phase that heard nothing files no claims, which reads exactly like a
    // clean slice. Checked here rather than at the top, so a document whose
    // every slice is already cached still finishes.
    if (resumed === undefined)
      signal.throwIfAborted();

    /* oxlint-disable no-await-in-loop -- sequential by design: aggregate concurrency beyond one stream per model collapses throughput on this plan, and each stage already fans out per model inside the chunk */
    /**
     * Repair outcome of this slice pair, recomputed only when not resumed.
     */
    const outcome = resumed ?? await (async function repairUnderSignal(): Promise<ChunkRepairOutcome> {
      try {
        return await repairChunk({
          client,
          chunkIndex,
          sourceText: slice.source
            .text,
          targetText: slice.target
            .text,
          lineStructured: lineStructuredSlices.has(chunkIndex,),
          models,
          ...(adjudicationConfig === undefined ? {} : { adjudicationConfig, }),
          ...identityFragment,
          signal,
          perCallTimeoutMs,
          l: rl,
        },);
      }
      catch (error) {
        // An aborted run fails BECAUSE it was aborted; whichever torn-down
        // exchange happened to surface is a symptom. A spent deadline and a
        // provider fault deserve different responses from the caller.
        if (!signal.aborted)
          throw error;
        rl.warn(
          `chunk ${String(chunkIndex,)}: abandoned by the caller's abort (${String(error,)})`,
        );
        throw signal.reason;
      }
    })();
    if (resumed === undefined) {
      signal.throwIfAborted();
      if (outcome.heardCritics === 0) {
        rl.warn(
          `chunk ${String(chunkIndex,)}: no critic was heard, so the slice ships `
            + 'unchanged and is NOT cached',
        );
      }
      else {
        await sliceCache?.persist({
          key: sliceKey,
          serialized: JSON.stringify(
            outcome,
            undefined,
            2,
          ),
        },);
      }
    }
    /* oxlint-enable no-await-in-loop */
    outcomes.push(outcome,);

    /**
     * Dominance verdict over every slice, standing marked where heard;
     * standing character share only grows, so deciding at the earliest
     * crossing spends no further quota on a wholly unrelated pair.
     */
    const dominance = assessNonTranslationDominance({
      slices: slices.map(function toTally(
        sliceRef,
        sliceIndex,
      ) {
        /**
         * This slice's settled outcome, absent until it is processed.
         */
        const sliceOutcome = outcomes[sliceIndex];
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
        `non-translation dominance (${String(dominance.standingChars,)} of ${
          String(dominance.totalChars,)
        } target chars); repair blocked, input returned unchanged`,
      );
      return blockedRepairResult({
        targetText,
        slices,
        outcomes,
        findings: [
          ...alignmentFindings,
          ...refusedCacheFindings,
        ],
        standingChars: dominance.standingChars,
        totalChars: dominance.totalChars,
      },);
    }
  }

  /**
   * Naturalness lane over every settled slice.
   *
   * Runs HERE, after every accuracy outcome settled and after the
   * non-translation dominance decision, and before anything below reads
   * `changed`. A blocked document already returned above, so no rewriter call
   * is ever spent on one, and a refinement-only change reaches
   * `changedOutcomes` and `anyChanged` because those are computed from these
   * final outcomes rather than from the accuracy ones.
   */
  const phase = await runRefinePhase({
    client,
    targetText,
    slices,
    outcomes,
    models,
    ...identityFragment,
    signal,
    perCallTimeoutMs,
    l: rl,
  },);

  /**
   * Final per-slice outcomes, accuracy plus any refinement that survived.
   */
  const finalOutcomes = phase.outcomes;

  return assembleRepair({
    targetText,
    slices,
    outcomes: finalOutcomes,
    findings: [
      ...alignmentFindings,
      ...refusedCacheFindings,
      ...finalOutcomes.flatMap(function toFindings(outcome,) {
        return outcome.findings;
      },),
      ...phase.findings,
    ],
    l: rl,
  },);
}

/**
 * Repairs one translation against its original, preparing the pair first.
 *
 * The entry point for a caller running the repair lane ALONE. A caller running
 * both lanes prepares once and calls {@link repairPreparedDocument} directly,
 * so the two lanes cannot disagree about what a slice is.
 *
 * @param client - injected model client
 *
 * @param sourceText - original document, front matter included
 *
 * @param targetText - translation under repair, front matter included
 *
 * @param models - role roster
 *
 * @param adjudicationConfig - tally thresholds and weights
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param sliceCharBudget - target-side characters one paragraph-bound
 * slice aims for; defaults to {@link SLICE_CHAR_BUDGET}
 *
 * @param sliceCache - optional cross-run cache; resumes finished slices
 * and persists newly finished ones so a large document survives aborts
 *
 * @returns Repaired candidate plus adjudicated issues and completion status
 *
 * @example
 * ```ts
 * const result = await repairTranslation({
 *   client,
 *   sourceText,
 *   targetText,
 *   models,
 *   signal,
 * },);
 * ```
 */
export async function repairTranslation(
  {
    client,
    sourceText,
    targetText,
    models,
    adjudicationConfig,
    signal,
    perCallTimeoutMs,
    sliceCharBudget = SLICE_CHAR_BUDGET,
    sliceCache,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly sourceText: string;
    readonly targetText: string;
    readonly models: RepairModels;
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs?: number;
    readonly sliceCharBudget?: number;
    readonly sliceCache?: SliceCache<ChunkRepairOutcome>;
  }>,
): Promise<RepairTranslationResult> {
  return await repairPreparedDocument({
    client,
    prepared: prepareDocumentPair({
      sourceText,
      targetText,
      sliceCharBudget,
    },),
    models,
    ...(adjudicationConfig === undefined ? {} : { adjudicationConfig, }),
    signal,
    ...(perCallTimeoutMs === undefined ? {} : { perCallTimeoutMs, }),
    ...(sliceCache === undefined ? {} : { sliceCache, }),
  },);
}

//endregion Repair translation
