import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { PatchOperation, } from './apply-patch.ts';
import type { RepairDocument, } from './parse-document.ts';
import { downgradeCount, } from './downgrade-count.ts';
import { footnoteBreakCount, } from './footnote-break-count.ts';
import type { EditableEnvelope, } from './patch-model.ts';
import type { IssueResolutionTally, } from './tally-resolution.ts';
import type { CandidateMeasurements, } from './select-candidate.ts';

//region Chunk candidate measurement
// Everything deterministic that selection ranks a patched chunk by, gathered in
// one place so the chunk runner stays a sequence of stages rather than a stage
// with arithmetic in it.
//
// Two of these measure less than their original names promised, and both now
// carry names that say what they actually count. `regressedKnownIssues` can only
// see EXISTING accepted issues the checkers marked worse, so a wholly new defect
// the patch introduces has nowhere to be counted; `touchedRegionChars` sums each
// touched envelope's longer side rather than differing characters, which a
// merged envelope serving several issues makes broad. The BEHAVIOR is unchanged
// on purpose: renaming is honest, while changing what selection ranks by is a
// pipeline decision that needs its own evidence.

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
  /**
   * Whether the patch left document grammar no worse than it found it.
   */
  const grammarOk = downgradeCount({ document: patchedDocument, },)
    <= downgradeCount({ document: targetDocument, },);

  /**
   * Whether the patch left footnote structure no worse than it found it.
   *
   * A broken footnote leaves the grammar perfectly valid, so the downgrade
   * signal cannot see it, and four settled repairs shipped footnote damage
   * because nothing else asked. Comparison rather than an absolute count: an
   * input translation is free to arrive with dangling references, and one does.
   *
   * Chunk-scoped like every other measurement here, so it sees damage a patch
   * does WITHIN one chunk. A definition deleted in one chunk whose reference
   * lives in another still passes, since neither chunk's own count rises.
   */
  const footnotesOk = footnoteBreakCount({ document: patchedDocument, },)
    <= footnoteBreakCount({ document: targetDocument, },);

  return {
    integrityOk: grammarOk && footnotesOk,
    resolvedHighSeverity: acceptedIssues.filter(function isResolvedHigh(issue,) {
      if (tallies[issue.issueId]
        ?.resolved
        !== true)
        return false;
      return (issue.severity === 'major') || (issue.severity === 'critical');
    },)
      .length,
    resolvedTotal,
    regressedKnownIssues: acceptedIssues.filter(function isRegressed(issue,) {
      return tallies[issue.issueId]
        ?.regressed
        === true;
    },)
      .length,
    touchedRegionChars: applied.reduce(
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

/**
 * Accepted issues the checkers confirmed fixed ON THE CANDIDATE, whether or not
 * that candidate won.
 *
 * Kept apart from what a slice REPORTS as resolved, which is gated on the
 * candidate shipping. A patched candidate that loses selection still produced
 * checker verdicts, and discarding them would leave every rejected repair
 * looking like one nobody examined.
 *
 * @param acceptedIssues - issues the panel accepted for this slice
 *
 * @param tallies - checker verdicts keyed by issue id
 *
 * @returns Ids the checkers confirmed, in the order the issues appear
 *
 * @example
 * ```ts
 * const confirmed = candidateConfirmedIssueIds({ acceptedIssues, tallies, },);
 * ```
 */
export function candidateConfirmedIssueIds(
  {
    acceptedIssues,
    tallies,
  }: {
    readonly acceptedIssues: readonly AdjudicatedIssue[];
    readonly tallies: Readonly<Record<string, IssueResolutionTally>>;
  },
): readonly string[] {
  return acceptedIssues
    .filter(function confirmedOnCandidate(issue,): boolean {
      return tallies[issue.issueId]
        ?.resolved
        === true;
    },)
    .map(function toId(issue,): string {
      return issue.issueId;
    },);
}

//endregion Chunk candidate measurement
