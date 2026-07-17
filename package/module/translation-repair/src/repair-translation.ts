import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  AdjudicatedIssue,
  AdjudicationConfig,
} from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { alignDocumentSections, } from './chunk-document.ts';
import { parseDocument, } from './parse-document.ts';
import {
  type ChunkRepairOutcome,
  repairChunk,
  type RepairModels,
} from './repair-chunk.ts';

//region Repair translation
// The batch driver over the whole loop: parse, align into chunk pairs, run
// each pair through the repair stages, splice winning chunks back into the
// document. Ensemble-agreed critical non-translation blocks repair and
// returns the input unchanged (settled architecture); everything else
// degrades chunk by chunk, never document-wide.

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
 * Wire-level critical non-translation votes that block repair;
 * two independent critics agreeing outranks one model's judgment on a
 * degenerate pair where anchoring is best-effort.
 */
export const NON_TRANSLATION_BLOCK_VOTES = 2;

/**
 * One adjudicated issue in the whole-document report.
 *
 * @example
 * ```ts
 * const record: RepairIssueRecord = { chunkIndex: 0, issue, resolved: false, };
 * ```
 */
export type RepairIssueRecord = {
  /**
   * Chunk the issue belongs to.
   */
  readonly chunkIndex: number;

  /**
   * Adjudicated issue exactly as the panel decided it.
   */
  readonly issue: AdjudicatedIssue;

  /**
   * Whether the checkers confirmed it fixed in the shipped text.
   */
  readonly resolved: boolean;
};

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
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly sourceText: string;
    readonly targetText: string;
    readonly models: RepairModels;
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs?: number;
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
   * Aligned chunk pairs covering both documents totally.
   */
  const alignment = alignDocumentSections({
    source: parseDocument({ text: sourceText, },),
    target: parseDocument({ text: targetText, },),
  },);

  /**
   * Alignment findings in scorecard-stable wording.
   */
  const alignmentFindings = alignment.findings
    .map(function toText(finding,) {
    return `alignment ${finding.kind} (pair ${String(finding.pairIndex,)}: ${finding.detail})`;
  },);
  rl.info(
    `${String(alignment.pairs
      .length,)} chunk pairs, ${
      String(alignmentFindings.length,)
    } alignment findings`,
  );

  /**
   * Chunk outcomes in pair order; sequential by design (see TSDoc).
   */
  const outcomes: ChunkRepairOutcome[] = [];
  for (const [pairIndex, pair,] of alignment.pairs
    .entries()) {
    /* oxlint-disable no-await-in-loop -- sequential by design: aggregate concurrency beyond one stream per model collapses throughput on this plan, and each stage already fans out per model inside the chunk */
    /**
     * Repair outcome of this chunk pair.
     */
    const outcome = await repairChunk({
      client,
      chunkIndex: pairIndex,
      sourceText: pair.source
        .text,
      targetText: pair.target
        .text,
      models,
      ...(adjudicationConfig === undefined ? {} : { adjudicationConfig, }),
      signal,
      perCallTimeoutMs,
      l: rl,
    },);
    /* oxlint-enable no-await-in-loop */
    if (outcome.nonTranslationVotes >= NON_TRANSLATION_BLOCK_VOTES) {
      rl.warn(
        `chunk ${String(pairIndex,)}: ${
          String(outcome.nonTranslationVotes,)
        } critics call it non-translation; repair blocked, input returned unchanged`,
      );
      return {
        repairedText: targetText,
        status: 'blocked-non-translation',
        issues: outcome.issues
          .map(function toRecord(issue,): RepairIssueRecord {
          return {
            chunkIndex: pairIndex,
            issue,
            resolved: false,
          };
        },),
        findings: [
          ...alignmentFindings,
          ...outcome.findings,
        ],
      };
    }
    outcomes.push(outcome,);
  }

  /**
   * Changed chunks in descending document order,
   * so splicing one never shifts the offsets of those still pending.
   */
  const changedOutcomes = outcomes
    .filter(function isChanged(outcome,) {
      return outcome.changed;
    },)
    .toSorted(function byOffsetDescending(
      left,
      right,
    ) {
      /**
       * Target chunks of both outcomes for their offsets.
       */
      const leftChunk = alignment.pairs[left.chunkIndex]
        ?.target;

      /**
       * Right-side chunk.
       */
      const rightChunk = alignment.pairs[right.chunkIndex]
        ?.target;
      return (rightChunk?.startOffset ?? 0) - (leftChunk?.startOffset ?? 0);
    },);

  /**
   * Translation rebuilt chunk by chunk.
   */
  const repairedText = changedOutcomes.reduce(
    function spliceChunk(
      text,
      outcome,
    ): string {
      /**
       * Target chunk being replaced, present by construction.
       */
      const chunk = alignment.pairs[outcome.chunkIndex]
        ?.target;
      if (chunk === undefined)
        throw new Error(`repair lost chunk ${String(outcome.chunkIndex,)}`,);
      return text.slice(
        0,
        chunk.startOffset,
      )
        + outcome.repairedText
        + text.slice(chunk.endOffset,);
    },
    targetText,
  );

  /**
   * Whole-document issue report.
   */
  const issues = outcomes.flatMap(function toRecords(outcome,) {
    return outcome.issues
      .map(function toRecord(issue,): RepairIssueRecord {
      return {
        chunkIndex: outcome.chunkIndex,
        issue,
        resolved: outcome.resolvedIssueIds
          .includes(issue.issueId,),
      };
    },);
  },);

  /**
   * Findings across alignment and every chunk.
   */
  const findings = [
    ...alignmentFindings,
    ...outcomes.flatMap(function toFindings(outcome,) {
      return outcome.findings;
    },),
  ];

  /**
   * Whether any chunk shipped a repair.
   */
  const anyChanged = changedOutcomes.length > 0;
  rl.info(
    `repair ${anyChanged ? 'shipped' : 'kept input'}: ${
      String(changedOutcomes.length,)
    }/${String(outcomes.length,)} chunks changed, ${String(issues.length,)} issues`,
  );

  return {
    repairedText,
    status: anyChanged ? 'repaired' : 'unchanged',
    issues,
    findings,
  };
}

//endregion Repair translation
