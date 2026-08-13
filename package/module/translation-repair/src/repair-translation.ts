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
 */
const SLICE_CACHE_VERSION = 6;

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
  for (const pair of alignment.pairs) {
    slices.push(...subdivideChunkPair({
      pair,
      sourceText,
      targetText,
      baseIndex: slices.length,
      budget: sliceCharBudget,
    },),);
  }
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
   * Whether any chunk shipped a repair.
   */
  const anyChanged = changedOutcomes.length > 0;
  rl.info(
    `repair ${anyChanged ? 'shipped' : 'kept input'}: ${
      String(changedOutcomes.length,)
    }/${String(finalOutcomes.length,)} chunks changed, ${String(issues.length,)} issues`,
  );

  return {
    repairedText,
    status: anyChanged ? 'repaired' : 'unchanged',
    issues,
    findings,
  };
}

//endregion Repair translation
