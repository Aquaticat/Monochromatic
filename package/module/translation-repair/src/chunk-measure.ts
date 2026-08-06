import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { PatchOperation, } from './apply-patch.ts';
import type { RepairDocument, } from './parse-document.ts';
import { downgradeCount, } from './downgrade-count.ts';
import type { EditableEnvelope, } from './patch-model.ts';
import type { IssueResolutionTally, } from './tally-resolution.ts';
import type { CandidateMeasurements, } from './select-candidate.ts';

//region Chunk candidate measurement
// Everything deterministic that selection ranks a patched chunk by, gathered in
// one place so the chunk runner stays a sequence of stages rather than a stage
// with arithmetic in it.
//
// Two of these measurements are narrower than their names promise, and both
// belong in `doc/todo` rather than in a silent rewrite here: `regressionCount`
// can only count EXISTING accepted issues the checkers marked regressed, so a
// wholly new defect the patch introduces has nowhere to be counted; and
// `changedCharCount` sums touched-region sizes rather than differing
// characters, which a merged envelope serving several issues makes broad.
// Neither is changed here, because changing what selection ranks by is a
// pipeline decision, not a refactor.

/**
 * Accepted issues an applied operation actually served.
 *
 * Selection credit is limited to these. Checkers are asked about EVERY accepted
 * issue, including ones no envelope could be cut for and ones whose envelope
 * received no surviving operation, and a checker reading the patched text can
 * call such an issue fixed. Counting that let a patch touching issue A beat
 * unchanged on credit for issue B that nothing touched, which is not evidence
 * the patch improved anything. Verdicts on unserved issues remain in the
 * tallies as telemetry; they simply stop deciding the selection.
 *
 * @param acceptedIssues - every accepted issue of the chunk
 *
 * @param envelopes - envelopes operations were written against
 *
 * @param applied - operations that survived the apply gate
 *
 * @returns Accepted issues an applied operation served, in issue order
 *
 * @example
 * ```ts
 * const creditable = selectCreditableIssues({ acceptedIssues, envelopes, applied, },);
 * ```
 */
export function selectCreditableIssues(
  {
    acceptedIssues,
    envelopes,
    applied,
  }: {
    readonly acceptedIssues: readonly AdjudicatedIssue[];
    readonly envelopes: readonly EditableEnvelope[];
    readonly applied: readonly PatchOperation[];
  },
): readonly AdjudicatedIssue[] {
  /**
   * Issues named by the envelope of some applied operation.
   */
  const served = new Set(
    applied.flatMap(function servedBy(operation,) {
      return envelopes.find(function matches(candidate,) {
        return candidate.envelopeId === operation.envelopeId;
      },)
        ?.issueIds
        ?? [];
    },),
  );
  return acceptedIssues.filter(function wasServed(issue,) {
    return served.has(issue.issueId,);
  },);
}

/**
 * Measures the patched candidate against the unchanged translation.
 *
 * @param acceptedIssues - accepted issues the checkers examined
 *
 * @param tallies - checker verdicts keyed by issue id
 *
 * @param resolvedTotal - count of issues the checkers confirmed fixed
 *
 * @param envelopes - envelopes operations were written against
 *
 * @param applied - operations that survived the apply gate
 *
 * @param patchedDocument - parsed patched candidate
 *
 * @param targetDocument - parsed unchanged translation
 *
 * @returns Measurements selection ranks by
 *
 * @example
 * ```ts
 * const measurements = measurePatchedCandidate({ ... },);
 * ```
 */
export function measurePatchedCandidate(
  {
    acceptedIssues,
    tallies,
    resolvedTotal,
    envelopes,
    applied,
    patchedDocument,
    targetDocument,
  }: {
    readonly acceptedIssues: readonly AdjudicatedIssue[];
    readonly tallies: Readonly<Record<string, IssueResolutionTally>>;
    readonly resolvedTotal: number;
    readonly envelopes: readonly EditableEnvelope[];
    readonly applied: readonly PatchOperation[];
    readonly patchedDocument: RepairDocument;
    readonly targetDocument: RepairDocument;
  },
): CandidateMeasurements {
  return {
    integrityOk: downgradeCount({ document: patchedDocument, },)
      <= downgradeCount({ document: targetDocument, },),
    resolvedHighSeverity: acceptedIssues.filter(function isResolvedHigh(issue,) {
      if (tallies[issue.issueId]
        ?.resolved
        !== true)
        return false;
      return (issue.severity === 'major') || (issue.severity === 'critical');
    },)
      .length,
    resolvedTotal,
    regressionCount: acceptedIssues.filter(function isRegressed(issue,) {
      return tallies[issue.issueId]
        ?.regressed
        === true;
    },)
      .length,
    changedCharCount: applied.reduce(
      function addChange(
        sum,
        operation,
      ): number {
        /**
         * Envelope of this operation, for its base length.
         */
        const envelope = envelopes.find(function matches(candidate,) {
          return candidate.envelopeId === operation.envelopeId;
        },);
        return sum + Math.max(
          envelope?.baseText
            .length
            ?? 0,
          operation.newText
            .length,
        );
      },
      0,
    ),
  };
}

//endregion Chunk candidate measurement
