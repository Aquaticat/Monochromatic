import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
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
import { repairChunk, } from './repair-chunk.ts';
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
 * Slice-cache schema version, mixed into every cache key.
 *
 * The cache stores serialized `ChunkRepairOutcome` values, so a run resuming
 * across a change to that shape would splice yesterday's outcomes into today's
 * report and silently answer a question they never recorded. Cached repair
 * provenance is the live example: outcomes written before repairs existed carry
 * none, and a resumed slice would contribute ungradable items to a precision
 * sheet without anything looking wrong. Bump this whenever
 * `ChunkRepairOutcome` changes shape OR an existing field changes meaning; the
 * structural guard in the cache store catches only the first of those.
 *
 * A GATE change is the second kind and is the easiest to miss, so version 6 is
 * recorded here as the example: the footnote-integrity gate left the prompts,
 * the roster and the texts identical, so the structural guard and `runShape`
 * both matched, while a candidate the old gate shipped may be one the new gate
 * refuses. `runShape` cannot catch that by construction, because it covers what
 * the models are ASKED and a gate changes only what the code does with their
 * answers. Nothing enforces this bump; it was missed once already, on the very
 * commit that added that gate.
 *
 * Version 7 is the same lesson applied straight away: widening typography
 * restoration from the replaced region to the whole document changes the text
 * that ships, with every prompt and every roster identical. Version 8 likewise:
 * naturalness eligibility stopped counting a repaired parse as a degraded one,
 * so slices that skipped the lane now enter it.
 *
 * Version 9 is the first bump for pure TELEMETRY, and it is still required:
 * `quote-not-found` findings gained a suffix naming whether collapsing soft
 * line breaks would have located the quote. No claim changes fate, but
 * `findings` is part of the cached payload, so a resumed slice would report
 * the old bare reason and understate the count the suffix exists to produce.
 *
 * Version 10 is telemetry again, and required for the same reason: the outcome
 * gained `claimAttributions` and `heardCriticIds`. No claim changes fate and no
 * text changes, but a slice resumed from a version-9 file would carry neither,
 * so an entry would silently mix attributable and unattributable slices. That
 * is precisely the population confusion the fields exist to prevent, so
 * resolving it by tolerating the old shape would defeat them.
 *
 * Version 11 is the first bump for a BEHAVIOUR change since 8: accepted issues
 * naming one defect in one place are now merged before envelopes are cut, so a
 * chunk emits fewer issues and cuts fewer envelopes than it did. A slice
 * resumed from a version-10 file would carry the duplicates the merge exists to
 * remove, and would have spent the editor's budget on them, so the two cannot
 * be mixed within one entry. Ratified in
 * `doc/decision/translation-repair-duplicate-issue-emission.md`.
 *
 * Version 12 is behaviour again: the preservation gate now runs inside
 * `applyPatchOperations` and rejects an operation that drops content no
 * accepted issue quoted. A slice resumed from version 11 carries text an edit
 * the gate would now refuse already changed, so the two cannot be mixed.
 *
 * Version 17 is behaviour by way of WHO WAS HEARD. The channel-marker stripper
 * now matches the shape of a truncated `<|word|>` tail rather than the single
 * exact string `|>`, so replies that reached version 16 as lost voices now
 * parse. A slice resumed from version 16 was decided by a smaller panel than
 * the same slice would convene now, and a chunk whose critic went unheard is
 * not the same chunk as one whose critic spoke.
 *
 * Version 18 changes the RECORD rather than the text: every stage now emits a
 * `stage-voice-lost` finding naming the models that never answered, including
 * when quorum was met. Findings are read as a whole per entry, so an entry
 * holding version-17 and version-18 slices would under-report voice loss on
 * exactly half of itself while looking complete.
 *
 * Version 19 completes that record in two ways it was still incomplete. One
 * finding is emitted PER MODEL rather than one naming a list, so counting
 * findings counts voices lost rather than gathers that lost at least one. And
 * the selection path carries its findings at all: `selectBestCandidate` built
 * them and every caller discarded them, so a judge going silent left no trace.
 * A version-18 slice under-counts on both.
 *
 * Version 20 finishes the audit that found version 19. The introduced-defect
 * probe emitted findings and BOTH its live callers dropped them, on the
 * accuracy path and in the naturalness lane, which is the one stage where a
 * lost voice is least distinguishable from a clean result. Every producer of
 * findings is now consumed except `derivability-probe.ts`, which is reached
 * only by the recall benchmark and writes into no per-entry artifact.
 *
 * Version 21 widens what the naturalness lane may touch. Eligibility excluded
 * every paragraph containing a newline, which rejected soft source wraps along
 * with authored line breaks; it now excludes only the latter. Measured over the
 * 92 entries at the pinned corpus commit, 811 of 2067 prose paragraphs carry an
 * internal newline and 29 carry a hard break, so a version-20 slice was refined
 * over a small fraction of the prose the lane could have reached. Those cached
 * slices hold text the current lane would have been free to rewrite.
 *
 * Version 22 corrects the line-structure sentence the editor is handed. It
 * opened `This region's CURRENT TEXT IS line-structured`, while the predicate
 * behind it reads the SOURCE, and on the case it exists for the two disagree:
 * `Toka_ls`'s verse chunk is 21 source blocks at median 22 against 18 target
 * blocks at median 101. Version-21 slices were edited under a sentence that
 * asserted something untrue about the text in front of the model and then asked
 * for one output line per INPUT line, which on an already-merged translation
 * asks for the merge to be preserved.
 *
 * Version 23 moves the line-structure decision from the slice to the enclosing
 * CHUNK. Version 22 asked the predicate about each slice, and the predicate
 * needs at least five blocks before it will answer anything but false, so
 * subdivision destroyed the evidence it reads. Measured on the version-22
 * `Toka_ls` run: the verse chunk is line-structured at 21 blocks, median 22,
 * and subdivides into seven slices of which ONE still trips it, while four
 * others sit at medians 20, 22, 23 and 29, inside the verse range, and fail
 * only for want of a fifth block. Version-22 slices therefore carry the
 * corrected sentence on a seventh of the verse it was written for.
 *
 * Version 24 stops the introduced-defect screen discarding over-deletions. A
 * cached slice carries the whole `repairChunk` outcome, probe report included,
 * so version-23 slices hold tallies screened by the old rule. That rule asked
 * whether a claim restated an accepted issue by testing containment BOTH ways,
 * which is right for added wording but wrong for removals: a removal claim
 * quotes what DISAPPEARED, drawn from the same side the critic quoted, on a
 * region that exists because the critic quoted something in it. Dropped wording
 * CONTAINING the prior quote is the over-deletion signal itself, and it was
 * being read as a restatement. Measured: removal-corroborated ran 159 across
 * the original 56-entry run and 0 across every run after the reclassification
 * landed, while corroborated held its per-region rate.
 *
 * Version 25 is behaviour by way of WHO WAS HEARD and WHO DECIDED, on two user
 * decisions of 2026-08-14. The editor and refiner stages no longer wait for
 * their whole roster, so a slice cached under version 24 was settled by a
 * gather that could spend four deadlines recovering a voice this one stops
 * asking for once quorum stands. And selection now seats producers, counting a
 * ballot for the judge's own work at half weight, where version 24 removed them
 * from the roster outright: the same candidates before the same models can
 * reach a different winner. Neither change touches a prompt, which is exactly
 * why the version has to move rather than the structural guard catching it.
 */
const SLICE_CACHE_VERSION = 25;

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
   *
   * Without it a resumed slice could return an outcome produced under a
   * different roster, a different adjudication threshold, or a different editor
   * addendum, and nothing would look wrong: the texts match, so the key matches.
   * That is the failure a version constant cannot catch, because no shape
   * changed. Identity context belongs here for the same reason, since it is
   * front-matter-derived prompt content that varies per document pair.
   */
  const runShape = JSON.stringify([
    models.criticModelIds,
    models.panelModelIds,
    models.editorModelIds,
    models.judgeModelIds,
    models.refinerModelIds ?? [],
    models.checkerModelIds,
    models.editorRuleAddendum ?? '',
    adjudicationConfig ?? null,
    identityFragment.identityContext ?? '',
  ],);

  /**
   * Slice outcomes in document order; sequential by design (see TSDoc).
   */
  const outcomes: ChunkRepairOutcome[] = [];
  for (const slice of slices) {
    /**
     * Global index of this slice, which every key and every outcome names.
     */
    const { chunkIndex, } = slice.target;

    /**
     * Cross-run key for this slice: the schema version, its index, and both
     * texts, so a slicing change, a content change, or an outcome-shape change
     * misses the cache and recomputes.
     */
    const sliceKey = hashContent({
      content: JSON.stringify([
        SLICE_CACHE_VERSION,
        runShape,
        chunkIndex,
        slice.source
          .text,
        slice.target
          .text,
        // Two slices can carry identical text and still be governed
        // differently, because the verdict belongs to the enclosing chunk. It
        // has to sit in the key rather than ride on the version alone.
        lineStructuredSlices.has(chunkIndex,),
      ],),
    },);

    /**
     * Outcome finished on an earlier run, when this slice is cached.
     */
    const resumed = sliceCache?.resumed
      .get(sliceKey,);
    if ((resumed !== undefined) && (resumed.chunkIndex !== chunkIndex)) {
      throw new Error(
        `cached repair slice ${String(resumed.chunkIndex,)} was loaded for slice `
          + `${String(chunkIndex,)}: the key derivation and the slicing `
          + 'disagree, so every resumed outcome is suspect',
      );
    }

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
      return {
        repairedText: targetText,
        status: 'blocked-non-translation',
        sliceCount: slices.length,
        issues: buildIssueRecords({
          outcomes,
          blocked: true,
        },),
        chunkCritics: buildChunkCriticRecords({ outcomes, },),
        // Nothing shipped and nothing was taken back at assembly: this exit
        // never reaches assembly. A blocked run returns its input, so no slice
        // carries a repair, and the withdrawal that says so belongs to the
        // issue records rather than to a guard that did not run.
        //
        // The per-slice wordings are what keep that readable rather than
        // trapping a consumer. Every slice still reports what it DECIDED, and
        // the empty shipped set says none of it reached the document; read
        // together they state "this lane had repairs and the document carries
        // none of them", which two empty index sets alone cannot.
        shippedChunkIndices: [],
        withdrawnChunkIndices: [],
        sliceTexts: buildLaneSliceTexts({
          slices,
          // This exit fires from INSIDE the slice loop, at the earliest
          // dominance crossing, so the slices after it were never examined.
          // Recording the archive wording as their decision would state a
          // choice nobody made.
          undecided: 'not-evaluated',
          decided: outcomes.map(function toDecision(outcome,): {
            readonly chunkIndex: number;
            readonly text: string;
          } {
            return {
              chunkIndex: outcome.chunkIndex,
              text: outcome.repairedText,
            };
          },),
        },),
        findings: [
          ...alignmentFindings,
          ...outcomes.flatMap(function toFindings(done,) {
            return done.findings;
          },),
          `non-translation dominance (${String(dominance.standingChars,)} of ${
            String(dominance.totalChars,)
          } target chars)`,
        ],
      };
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
