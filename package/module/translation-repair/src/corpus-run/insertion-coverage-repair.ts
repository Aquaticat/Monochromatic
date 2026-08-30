import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import { runCoverageStage, } from '../coverage-stage.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import { TranslationRepairInterruptedError, } from '../translation-repair-interrupted-error.ts';
import type { AnchorTarget, } from '../validate-issue.ts';
import type { InsertionCoverageRow, } from './insertion-coverage-model.ts';

//region Insertion coverage repair

/**
 * Continues one unresolved insertion placement under distinct prompt.
 *
 * @param client - provider client shared with pass stages
 *
 * @param modelIds - coverage roster
 *
 * @param row - latest semantic and deterministic evidence
 *
 * @param target - whole target document used for quote anchoring
 *
 * @param shortfallAdmitted - whether latest shortfall admits passage
 *
 * @param attemptedTasks - canonical follow-up identities already attempted
 *
 * @param priorFindings - current document-level insertion findings
 *
 * @param signal - caller abort
 *
 * @param exchangeTimeoutMs - deadline per coverage exchange
 *
 * @param l - stage logger
 *
 * @returns Row updated from distinct follow-up coverage pass
 *
 * @throws {@link TranslationRepairInterruptedError} on exact task cycle or provider silence
 *
 * @example
 * ```ts
 * const repaired = await repairInsertionCoverageRow({ ...inputs, });
 * ```
 */
export async function repairInsertionCoverageRow(
  {
    client,
    modelIds,
    row,
    target,
    shortfallAdmitted,
    attemptedTasks,
    priorFindings,
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly row: InsertionCoverageRow;
    readonly target: AnchorTarget;
    readonly shortfallAdmitted: boolean;
    readonly attemptedTasks: Set<string>;
    readonly priorFindings: readonly string[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<InsertionCoverageRow> {
  /**
   * Latest evidence grounding follow-up responsibility.
   */
  const followupEvidence = {
    verdictKind: row.verdictKind,
    anchoredFull: row.anchoredFull,
    anchoredPartial: row.anchoredPartial,
    absent: row.absentCount,
    heard: row.heard,
    asked: row.asked,
    evidence: row.coverageEvidence,
    missingDestinationCount: row.missingDestinationCount,
    shortfallAdmitted,
  } as const;
  /**
   * Canonical prompt input for this candidate's follow-up task.
   */
  const taskIdentity = JSON.stringify({
    position: row.position,
    followupEvidence,
  },);
  if (attemptedTasks.has(taskIdentity,)) {
    throw new TranslationRepairInterruptedError({
      reason: 'insertion-placement-unresolved',
      findings: priorFindings,
    },);
  }
  attemptedTasks.add(taskIdentity,);
  /**
   * Distinct follow-up reading grounded in latest unresolved evidence.
   */
  const answer = await runCoverageStage({
    client,
    modelIds,
    sourcePassage: row.sourceText,
    translation: target,
    followupEvidence,
    signal,
    exchangeTimeoutMs,
    l,
  },);
  /**
   * Latest verdict and stage findings from follow-up.
   */
  const {
    verdict,
    findings: answerFindings,
  } = answer;
  if (verdict.heard === 0) {
    throw new TranslationRepairInterruptedError({
      reason: 'provider-unavailable',
      findings: [
        ...priorFindings,
        ...answerFindings,
      ],
    },);
  }
  /**
   * Latest count-only coverage finding.
   */
  const coverageFinding = `insertion-coverage (slice ${String(row.sliceIndex,)}, verdict ${verdict.kind}, `
    + `full ${String(verdict.anchoredFull,)}, partial ${String(verdict.anchoredPartial,)}, `
    + `absent ${String(verdict.absent,)}, heard ${String(verdict.heard,)} of ${String(verdict.asked,)})`;
  return {
    ...row,
    verdictKind: verdict.kind,
    anchoredFull: verdict.anchoredFull,
    anchoredPartial: verdict.anchoredPartial,
    absentCount: verdict.absent,
    heard: verdict.heard,
    asked: verdict.asked,
    coverageFinding,
    stageFindings: [
      ...row.stageFindings,
      row.coverageFinding,
      ...answerFindings,
    ],
    coverageEvidence: verdict.evidence,
  };
}

//endregion Insertion coverage repair
