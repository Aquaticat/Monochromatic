import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import {
  alignDocumentSections,
  type ChunkPair,
} from './chunk-document.ts';
import { hashContent, } from './document-node.ts';
import { collectIdentityLines, } from './identity-context.ts';
import {
  type ChunkGovernance,
  type ChunkSlice,
  governedSliceIndices,
} from './line-structure-inherit.ts';
import {
  assessNonTranslationDominance,
  sliceAnchorsTranslation,
} from './non-translation-evidence.ts';
import { parseDocument, } from './parse-document.ts';
import {
  SLICE_CHAR_BUDGET,
  subdivideChunkPair,
} from './slice-pair.ts';
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
import { spliceSlices, } from './splice-slices.ts';
import type {
  ChunkRepairOutcome,
  RepairModels,
} from './repair-contract.ts';

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
 * Completion status of one repair run;
 * never an unqualified "corrected translation".
 *
 * @example
 * ```ts
 * const status: RepairStatus = 'repaired';
 * ```
 */
export type RepairStatus =
  | 'repaired'
  | 'unchanged'
  | 'blocked-non-translation';

/**
 * Cross-run slice cache making a large document resumable: completed slice
 * outcomes keyed by a deterministic hash of the slice's index and text, so
 * a run aborted at the hard cap resumes from the last finished slice
 * instead of recomputing from scratch. Injected like the client, so the
 * result stays a function of inputs and the resumed outcomes; `persist` is
 * a write-through side effect that never feeds back into the result.
 *
 * @example
 * ```ts
 * const cache: SliceCache = {
 *   resumed: new Map(),
 *   persist: async (key, outcome,) => writeSliceFile(key, outcome,),
 * };
 * ```
 */
export type SliceCache = {
  /**
   * Outcomes finished on an earlier run, keyed by slice hash; a hit skips
   * every model call for that slice.
   */
  readonly resumed: ReadonlyMap<string, ChunkRepairOutcome>;

  /**
   * Persists one freshly computed slice's serialized outcome under its hash
   * key before the next slice starts, so an abort leaves finished slices
   * recoverable. The pipeline owns the serialization; the driver writes
   * exactly these bytes and parses them back into {@link resumed} next run.
   */
  readonly persist: (
    key: string,
    serialized: string,
  ) => Promise<void>;
};

/**
 * Output contract of the batch driver.
 *
 * @example
 * ```ts
 * const { repairedText, status, issues, } = await repairTranslation({ ... },);
 * ```
 */
export type RepairTranslationResult = {
  /**
   * Best translation the run can justify;
   * equals the input when nothing demonstrably beat it.
   */
  readonly repairedText: string;

  /**
   * How the run ended.
   */
  readonly status: RepairStatus;

  /**
   * Every adjudicated issue with its chunk and resolution fate.
   */
  readonly issues: readonly RepairIssueRecord[];

  /**
   * Alignment and stage findings in scorecard-stable wording.
   */
  readonly findings: readonly string[];

  /**
   * Per-chunk critic calibration: who answered, and who raised each claim.
   *
   * Separate from {@link RepairTranslationResult.issues} because a chunk whose
   * critics raised nothing produces no issue record, and that chunk is exactly
   * the one a rate needs: it is the difference between a critic that was asked
   * and stayed quiet and a critic that was never asked.
   */
  readonly chunkCritics: readonly ChunkCriticRecord[];
};

/**
 * Repairs one translation against its original.
 * Stages are pure `(state, responses) -> newState`; this driver is the
 * imperative shell that owns model calls, chunk order, and reassembly.
 * Chunks run sequentially because aggregate concurrency beyond one stream
 * per model collapses throughput on this plan, and each stage already fans
 * out one call per model inside the chunk.
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
    perCallTimeoutMs = DEFAULT_PIPELINE_CALL_TIMEOUT_MS,
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
    readonly sliceCache?: SliceCache;
  }>,
): Promise<RepairTranslationResult> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: repairTranslation.name,
    l,
  },);

  /**
   * Whole original document, parsed once and reused for both alignment and
   * the identity block chunk text cannot supply.
   */
  const sourceDocument = parseDocument({ text: sourceText, },);

  /**
   * Whole translation document, parsed once for the same two uses.
   */
  const targetDocument = parseDocument({ text: targetText, },);

  /**
   * Declared names and handles from both sides' front matter. Front matter is
   * document-level while critics see chunk text, so this is the only path by
   * which a declared correspondence reaches them. Empty when neither side
   * declares anything.
   */
  const identityLines = collectIdentityLines({
    sourceData: sourceDocument.frontMatter
      ?.data,
    targetData: targetDocument.frontMatter
      ?.data,
  },);

  /**
   * Identity block spread into the chunk call, omitted entirely when nothing
   * is declared so the prompt never carries an empty heading.
   */
  const identityFragment = identityLines.length === 0
    ? {}
    : { identityContext: identityLines.join('\n',), };

  /**
   * Aligned chunk pairs covering both documents totally.
   */
  const alignment = alignDocumentSections({
    source: sourceDocument,
    target: targetDocument,
  },);

  /**
   * Alignment findings in scorecard-stable wording.
   */
  const alignmentFindings = alignment.findings
    .map(function toText(finding,) {
    return `alignment ${finding.kind} (pair ${String(finding.pairIndex,)}: ${finding.detail})`;
  },);
  /**
   * Paragraph-bound slice pairs across every aligned section, indexed
   * globally in document order.
   */
  const slices: ChunkPair[] = [];

  /**
   * Slices whose enclosing CHUNK's original is line-structured.
   *
   * Decided on the chunk and inherited by its slices, because the predicate
   * needs at least five blocks and subdivision routinely leaves fewer. Measured
   * on `Toka_ls`: the verse chunk trips at 21 blocks, median 22, then
   * subdivides into seven slices of which one still trips, while four more sit
   * at medians 20, 22, 23 and 29 and fail only for want of a fifth block.
   * Deciding per slice therefore dropped the instruction on most of the verse
   * it exists for.
   */
  const governance: ChunkGovernance[] = [];
  for (const pair of alignment.pairs) {
    /**
     * Slices carved from this chunk.
     */
    const carved = subdivideChunkPair({
      pair,
      sourceText,
      targetText,
      baseIndex: slices.length,
      budget: sliceCharBudget,
    },);
    governance.push({
      sourceText: pair.source
        .text,
      slices: carved.map(function toSlice(carvedSlice,): ChunkSlice {
        return {
          index: carvedSlice.target
            .chunkIndex,
          sourceText: carvedSlice.source
            .text,
        };
      },),
    },);
    slices.push(...carved,);
  }

  /**
   * Slices the line-structure rule governs, inherited from their chunk.
   */
  const lineStructuredSlices = governedSliceIndices({ chunks: governance, },);
  rl.info(
    `${String(alignment.pairs
      .length,)} chunk pairs, ${String(slices.length,)} slices, ${
      String(alignmentFindings.length,)
    } alignment findings`,
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
     * Cross-run key for this slice: the schema version, its index, and both
     * texts, so a slicing change, a content change, or an outcome-shape change
     * misses the cache and recomputes.
     */
    const sliceKey = hashContent({
      content: JSON.stringify([
        SLICE_CACHE_VERSION,
        runShape,
        slice.target
          .chunkIndex,
        slice.source
          .text,
        slice.target
          .text,
        // Two slices can carry identical text and still be governed
        // differently, because the verdict belongs to the enclosing chunk. It
        // has to sit in the key rather than ride on the version alone.
        lineStructuredSlices.has(
          slice.target
            .chunkIndex,
        ),
      ],),
    },);

    /**
     * Outcome finished on an earlier run, when this slice is cached.
     */
    const resumed = sliceCache?.resumed
      .get(sliceKey,);

    /* oxlint-disable no-await-in-loop -- sequential by design: aggregate concurrency beyond one stream per model collapses throughput on this plan, and each stage already fans out per model inside the chunk */
    /**
     * Repair outcome of this slice pair, recomputed only when not resumed.
     */
    const outcome = resumed ?? await repairChunk({
      client,
      chunkIndex: slice.target
        .chunkIndex,
      sourceText: slice.source
        .text,
      targetText: slice.target
        .text,
      lineStructured: lineStructuredSlices.has(
        slice.target
          .chunkIndex,
      ),
      models,
      ...(adjudicationConfig === undefined ? {} : { adjudicationConfig, }),
      ...identityFragment,
      signal,
      perCallTimeoutMs,
      l: rl,
    },);
    if (resumed === undefined)
      await sliceCache?.persist(
        sliceKey,
        JSON.stringify(
          outcome,
          undefined,
          2,
        ),
      );
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
        issues: buildIssueRecords({
          outcomes,
          blocked: true,
        },),
        chunkCritics: buildChunkCriticRecords({ outcomes, },),
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

  /**
   * Slices whose shipped text differs from the input.
   */
  const changedOutcomes = finalOutcomes.filter(function isChanged(outcome,) {
    return outcome.changed;
  },);

  /**
   * Translation rebuilt slice by slice.
   */
  const repairedText = spliceSlices({
    targetText,
    slices,
    outcomes: finalOutcomes,
  },);

  /**
   * Whole-document issue report.
   */
  const issues = buildIssueRecords({
    outcomes: finalOutcomes,
    blocked: false,
  },);

  /**
   * Findings across alignment and every chunk.
   */
  const findings = [
    ...alignmentFindings,
    ...finalOutcomes.flatMap(function toFindings(outcome,) {
      return outcome.findings;
    },),
    ...phase.findings,
  ];

  /**
   * Whether any slice shipped a repair.
   */
  const anyChanged = changedOutcomes.length > 0;
  // SLICES rather than chunks: both arrays hold slice outcomes, and a section
  // subdivides into several, so reporting them as chunks understates the
  // denominator against every other count in the artifact.
  rl.info(
    `repair ${anyChanged ? 'shipped' : 'kept input'}: ${
      String(changedOutcomes.length,)
    }/${String(finalOutcomes.length,)} slices changed, ${String(issues.length,)} issues`,
  );

  /**
   * Per-chunk critic calibration for the artifact.
   */
  const chunkCritics = buildChunkCriticRecords({ outcomes: finalOutcomes, },);

  return {
    chunkCritics,
    repairedText,
    status: anyChanged ? 'repaired' : 'unchanged',
    issues,
    findings,
  };
}

//endregion Repair translation
