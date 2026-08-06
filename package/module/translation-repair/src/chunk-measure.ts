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
