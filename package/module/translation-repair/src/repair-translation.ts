import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import { notApplicableRepair, } from './repair-not-applicable.ts';
import {
  type PreparedDocumentPair,
  prepareDocumentPair,
} from './document-preparation.ts';
import {
  assessNonTranslationDominance,
  sliceAnchorsTranslation,
} from './non-translation-evidence.ts';
import { nonTranslationDominanceFinding, } from './non-translation-finding.ts';
import { SLICE_CHAR_BUDGET, } from './slice-pair.ts';
import { refineSettledSlices, } from './repair-refine-step.ts';
import {
  repairRunShape,
  repairSliceKey,
} from './repair-slice-key.ts';
import {
  assertSettledRecordAgrees,
  resumedSliceDiscardFinding,
  sliceRecordAgrees,
} from './slice-record-agreement.ts';
import { blockedRepairResult, } from './repair-blocked-exit.ts';
import { repairChunk, } from './repair-chunk.ts';
import { assertRostersConfigured, } from './roster-configuration.ts';
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

  /**
   * Outcomes this run settled, by the key they answer.
   *
   * WITHIN one run, for the same reason the cache holds them across runs: two
   * slices carrying identical source, target and governance ask one question,
   * and since version 26 the key says so. Without this a COLD run would ask the
   * models twice, keep two different answers and persist both under one key,
   * while the next WARM run resumed a single outcome for both slices, so the
   * same document settled differently depending on whether a cache existed.
   */
  const settledByKey = new Map<string, ChunkRepairOutcome>();
  for (const slice of slices) {
    /**
     * Global index of this slice, which every outcome and every replacement
     * names. NOT part of the cache key since version 26: a key says what the
     * stages are asked, and where a slice sits is not part of that question.
     */
    const { chunkIndex, } = slice.target;
    if (isInsertionChunk(slice.target,)) {
      // NOTHING TO REPAIR, and nothing bought to discover that. Every stage of
      // this lane reads existing wording, so an anchor would have critics
      // filing complaints about a blank at full roster cost.
      //
      // The dominance check below is skipped with it, which is sound rather
      // than convenient: the tally reads `outcomes` by position, and this
      // outcome contributes zero target characters, no standing vote and no
      // anchoring evidence, which is exactly what a missing entry contributes.
      // The verdict would be the one the previous slice already produced.
      rl.info(
        `chunk ${String(chunkIndex,)}: no translation to repair; `
          + 'the translate lane owns this passage',
      );
      outcomes.push(notApplicableRepair({ chunkIndex, },),);
      continue;
    }

    /**
     * Cross-run key for this slice.
     */
    const sliceKey = repairSliceKey({
      runShape,
      sourceText: slice.source
        .text,
      targetText: slice.target
        .text,
      lineStructured: lineStructuredSlices.has(chunkIndex,),
    },);

    /**
     * Outcome already settled for this exact question, exactly as it was
     * stored, whether by a previous run or earlier in this one.
     */
    const stored = sliceCache?.resumed
      .get(sliceKey,)
      ?? settledByKey.get(sliceKey,);

    /**
     * That outcome RE-STAMPED with the index this run asked under.
     *
     * Since version 26 the key is the texts and the run shape, so an identical
     * slice elsewhere in the document legitimately answers here, and the index
     * it was computed with would name the wrong slice in every issue record and
     * replacement built from it.
     */
    const cached = (stored === undefined) ? undefined : {
      ...stored,
      chunkIndex,
    };

    /**
     * Whether that outcome's changed flag agrees with its own text, which is
     * the one thing a cached record can be checked against without asking
     * anybody. A record that disagrees is refused HERE rather than at assembly,
     * where the same contradiction fails the whole document after every other
     * slice has been bought.
     */
    const trustworthy = (cached === undefined)
      || sliceRecordAgrees({
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

      // Checked on the way OUT of the stage as well as on the way back in from
      // the cache, and before the write either way, so nothing contradicting
      // itself is ever stored. `repairChunk` derives `changed` from its own
      // text today, which makes this vacuous by construction; what it pins is
      // that it keeps doing so, and that is a derivation no test can otherwise
      // hold in place.
      assertSettledRecordAgrees({
        lane: 'repair',
        chunkIndex,
        changed: outcome.changed,
        decidedText: outcome.repairedText,
        incumbentText: slice.target
          .text,
      },);
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

        // MEMOIZED EXACTLY WHERE IT IS PERSISTED, which is the point of the
        // memoization: a warm run can only resume what reached the cache, so an
        // in-run twin must reuse only what a warm run would have found. Doing it
        // unconditionally reused an outcome this lane deliberately refused to
        // store, and broke the cold-warm agreement it exists to keep. A RESUMED
        // outcome needs no entry either: it came from a map that still holds it.
        settledByKey.set(
          sliceKey,
          outcome,
        );
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
        `${nonTranslationDominanceFinding(dominance,)}; repair blocked, `
          + `input returned unchanged`,
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
  const phase = await refineSettledSlices({
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
