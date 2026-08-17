import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  type AuditMemberClaim,
  type CorroboratedDefect,
  corroborate,
  type NearMiss,
  nearMisses,
} from './rendering-audit-corroborate.ts';
import { buildRenderingAuditMessages, } from './rendering-audit-prompt.ts';
import {
  RENDERING_AUDIT_RESPONSE_FORMAT,
  type RenderingAuditSubject,
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
// WHAT COUNTS AS THE SAME DEFECT lives in `rendering-audit-corroborate.ts`,
// which compares FOCUS INTERVALS rather than quoted text, and reports overlap
// as a near miss rather than merging it.
//
// PER-VOICE ROWS ARE KEPT. `#68` measured three probers disagreeing by an order
// of magnitude about how often an edit is worth a claim, and the decision about
// how to read a tally over such a roster is still open. A report that kept only
// the aggregate would have to be re-run to answer it; one that keeps the rows
// can be re-read.

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
   * What it claimed that anchored.
   */
  readonly findings: readonly ScreenedFinding[];

  /**
   * Why each of its dropped claims fell, kept because a voice whose every claim
   * fell is not a voice that found nothing.
   */
  readonly dropped: readonly string[];
};

/**
 * Everything one audit produced about one rendering.
 *
 * @example
 * ```ts
 * const report: RenderingAuditReport = { corroborated: [], near: [], rows: [], findings: [], };
 * ```
 */
export type RenderingAuditReport = {
  /**
   * Defects at least two auditors located identically, most-agreed first.
   */
  readonly corroborated: readonly CorroboratedDefect[];

  /**
   * Pairs of claims from different voices that nearly agreed, reported rather
   * than merged, since a merge on overlap would manufacture agreement nobody
   * reached.
   */
  readonly near: readonly NearMiss[];

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

  /**
   * Every anchored claim, tagged with the voice that made it, which is the form
   * both the matcher and the near-miss pass read.
   */
  const claims: readonly AuditMemberClaim[] = rows.flatMap(function toClaims(row,): readonly AuditMemberClaim[] {
    return row.findings
      .map(function toClaim(finding,): AuditMemberClaim {
        return {
          modelId: row.modelId,
          finding,
        };
      },);
  },);

  return {
    corroborated: corroborate({ claims, },),
    near: nearMisses({ claims, },),
    rows,
    findings: gathered.findings,
  };
}

//endregion Rendering audit stage
