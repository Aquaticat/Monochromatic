import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  type RenderingAuditCategory,
  RENDERING_AUDIT_RESPONSE_FORMAT,
  type RenderingAuditSubject,
  buildRenderingAuditMessages,
  isRenderingAuditReportWire,
} from './rendering-audit-wire.ts';
import {
  type ScreenedFinding,
  screenRenderingAudit,
} from './rendering-audit-screen.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Rendering audit stage
// Asks a roster whether one rendering says what its original says, screens
// every answer against the two texts, and reports what more than one voice
// found.
//
// SHADOW MODE, like the probe it sits beside. Nothing here decides what ships.
// The instrument's own error rate is unmeasured until its two live arms run,
// and gating on an unmeasured instrument is how a false claim discards a
// correct rendering.
//
// CORROBORATION IS BY DISTINCT VOICE, on the same rule the introduced-defect
// probe uses: a defect two auditors found independently is a different fact
// from one auditor's opinion, and the roster is the only independence available
// here.
//
// TWO FINDINGS MATCH WHEN THEY NAME THE SAME CATEGORY OVER THE SAME SPAN, where
// the span is the TEXT'S OWN wording rather than what either voice typed, since
// the screen already replaced each quote with the characters the document
// carries. Two voices quoting the same clause with different punctuation
// therefore corroborate each other, and two quoting different clauses do not,
// however similar their prose.
//
// PER-VOICE ROWS ARE KEPT. `#68` measured three probers disagreeing by an order
// of magnitude about how often an edit is worth a claim, and the decision about
// how to read a tally over such a roster is still open. A report that kept only
// the aggregate would have to be re-run to answer it; one that keeps the rows
// can be re-read.

/**
 * How many distinct voices must find one defect for it to count as corroborated.
 *
 * TWO, not a majority, and the difference matters at this roster size: the
 * question this instrument answers first is whether a defect is THERE, and a
 * majority rule over six voices would discard a defect four of them missed. The
 * tally keeps the count, so a stricter rule can be applied later without
 * re-running anything.
 */
const CORROBORATION_VOICES = 2;

/**
 * One auditor's screened answer, kept whole.
 *
 * @example
 * ```ts
 * const row: AuditVoiceRow = { modelId, verdict: 'no-defect-found', findings: [], dropped: [], };
 * ```
 */
export type AuditVoiceRow = {
  /**
   * Auditor that answered.
   */
  readonly modelId: SyntheticModelId;

  /**
   * What it concluded overall.
   */
  readonly verdict: string;

  /**
   * What it claimed that proved itself.
   */
  readonly findings: readonly ScreenedFinding[];

  /**
   * Why each of its dropped claims fell, kept because a voice whose every claim
   * fell is not a voice that found nothing.
   */
  readonly dropped: readonly string[];
};

/**
 * One defect and how many voices found it.
 *
 * @example
 * ```ts
 * const defect: CorroboratedDefect = { category: 'altered-polarity', voices: 2, ... };
 * ```
 */
export type CorroboratedDefect = {
  /**
   * Category every voice counted here named.
   */
  readonly category: RenderingAuditCategory;

  /**
   * Original's own wording for the span, empty where the category proves itself
   * from the candidate alone.
   */
  readonly sourceEvidence: string;

  /**
   * Candidate's own wording, empty for the mirror case.
   */
  readonly candidateEvidence: string;

  /**
   * Distinct auditors that named this defect over this span.
   */
  readonly voices: number;

  /**
   * What each of them said it amounts to, in voice order.
   */
  readonly reasons: readonly string[];
};

/**
 * Everything one audit produced about one rendering.
 *
 * @example
 * ```ts
 * const report: RenderingAuditReport = { corroborated: [], rows: [], findings: [], };
 * ```
 */
export type RenderingAuditReport = {
  /**
   * Defects at least {@link CORROBORATION_VOICES} auditors found, most-agreed
   * first.
   */
  readonly corroborated: readonly CorroboratedDefect[];

  /**
   * Every auditor's screened answer, kept for a later decision about how to
   * read a tally over a roster that disagrees with itself.
   */
  readonly rows: readonly AuditVoiceRow[];

  /**
   * Degradation findings from the gather, empty when quorum was met.
   */
  readonly findings: readonly string[];
};

/**
 * Key under which two findings count as the same defect.
 *
 * @param finding - screened finding
 *
 * @returns Category and both evidence spans, joined by a separator none of them
 * can contain unescaped
 *
 * @example
 * ```ts
 * const key = defectKey({ finding, },);
 * ```
 */
function defectKey({ finding, }: { readonly finding: ScreenedFinding; },): string {
  return JSON.stringify([
    finding.category,
    finding.sourceEvidence,
    finding.candidateEvidence,
  ],);
}

/**
 * Counts each defect across the voices that named it.
 *
 * @param rows - every auditor's screened answer
 *
 * @returns Defects reaching the corroboration threshold, most-agreed first
 *
 * @example
 * ```ts
 * const corroborated = corroborate({ rows, },);
 * ```
 */
function corroborate(
  { rows, }: { readonly rows: readonly AuditVoiceRow[]; },
): readonly CorroboratedDefect[] {
  /**
   * Every claim, grouped by what it claims.
   *
   * ONE VOICE COUNTS ONCE per defect, which the inner set enforces: an auditor
   * that reports the same span twice in one answer is one opinion, and counting
   * it twice would let a single voice corroborate itself.
   */
  const grouped = rows.reduce(
    function collectRow(
      groups: Map<string, {
        readonly finding: ScreenedFinding;
        readonly voices: Set<string>;
        readonly reasons: string[];
      }>,
      row,
    ) {
      for (const finding of row.findings) {
        /**
         * Key this finding is counted under.
         */
        const key = defectKey({ finding, },);

        /**
         * What has been collected for this defect so far.
         */
        const group = groups.get(key,) ?? {
          finding,
          voices: new Set<string>(),
          reasons: [],
        };

        if (!group.voices
          .has(row.modelId,)) {
          group.voices
            .add(row.modelId,);
          group.reasons
            .push(finding.reason,);
        }

        groups.set(
          key,
          group,
        );
      }

      return groups;
    },
    new Map<string, {
      readonly finding: ScreenedFinding;
      readonly voices: Set<string>;
      readonly reasons: string[];
    }>(),
  );

  return [...grouped.values(),]
    .filter(function reachedThreshold(group,): boolean {
      /**
       * Distinct auditors that named this defect.
       */
      const found = group.voices
        .size;

      return found >= CORROBORATION_VOICES;
    },)
    .map(function toDefect(group,): CorroboratedDefect {
      return {
        category: group.finding
          .category,
        sourceEvidence: group.finding
          .sourceEvidence,
        candidateEvidence: group.finding
          .candidateEvidence,
        voices: group.voices
          .size,
        reasons: [...group.reasons,],
      };
    },)
    .toSorted(function byAgreement(
      left,
      right,
    ): number {
      return right.voices - left.voices;
    },);
}

/**
 * Audits one rendering against its original.
 *
 * @param client - injected model client
 *
 * @param subject - original, candidate and any licensed identity evidence
 *
 * @param modelIds - auditor roster
 *
 * @param signal - entry deadline and caller abort
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Corroborated defects, every voice's screened answer, and any
 * degradation findings
 *
 * @throws Whatever the gather raises when the caller aborts
 *
 * @example
 * ```ts
 * const report = await runRenderingAudit({ client, subject, modelIds, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function runRenderingAudit(
  {
    client,
    subject,
    modelIds,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly subject: RenderingAuditSubject;
    readonly modelIds: readonly SyntheticModelId[];
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<RenderingAuditReport> {
  /**
   * What every auditor answered, to quorum.
   */
  const gathered = await gatherStageVoices({
    client,
    modelIds,
    messages: buildRenderingAuditMessages({ subject, },),
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: RENDERING_AUDIT_RESPONSE_FORMAT,
    validate: isRenderingAuditReportWire,
    stage: runRenderingAudit.name,
    l,
  },);

  /**
   * Each answer screened against the two texts.
   */
  const rows: readonly AuditVoiceRow[] = gathered.voices
    .map(function screenVoice(voice,): AuditVoiceRow {
      /**
       * What survived of this voice's answer.
       */
      const screened = screenRenderingAudit({
        report: voice.value,
        sourceText: subject.sourceText,
        candidateText: subject.candidateText,
      },);

      return {
        modelId: voice.modelId,
        verdict: screened.verdict,
        findings: screened.findings,
        dropped: screened.dropped,
      };
    },);

  return {
    corroborated: corroborate({ rows, },),
    rows,
    findings: gathered.findings,
  };
}

//endregion Rendering audit stage
