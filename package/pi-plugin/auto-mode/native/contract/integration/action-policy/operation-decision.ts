/** The decision model reconsiders complete operations before the manual fallback. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { admitsOperatingChoice } from '../maintained-policy.mjs';
import { ruleAssessmentModel } from './assessment-model.ts';
import { operationDecisionLabels } from './operation-decision-definition.ts';
import type { GuardOutcome } from '../../../../src/guard-outcome.ts';
import type { JudgmentPublicAPI } from '../../collector/program-rule-batch-sdk-copy-v2/input/judgment-api-types.ts';
import type { QuestionEvidence } from '../../lifecycle/claim-evidence-batch-selection/selection-owner-types.ts';

/** Malformed original evidence cannot become an execution decision. */
export class OperationDecisionEvidenceError extends Error {}

/** Decision logs contain choices and lifecycle events, never original command or policy text. */
const l = tagged({ tag: 'auto-mode-operation-decision' });

//region One distinct fallback question shares the existing judgment's lifetime and transport allowance.

/**
 Authenticate the fallback estimate before applying the already adopted categorical operating cutoff.

 @param record - evidence authenticated by the original judgment

 @returns operating decision or explicit uncertainty for the last-resort dialog

 @throws OperationDecisionEvidenceError for mismatched definition, scope, or serving model
 */
function resolveOperationDecision(record: QuestionEvidence): GuardOutcome {
  /** Original evidence contains a scope marker, never caller-authored replacement commands. */
  const { binding, answer } = record;
  if ((record.definitionId !== 'operation_decision') || (record.definition.type !== 'choice')
    || (binding === null) || ((typeof binding) !== 'object')
    || !('claimScope' in binding) || (binding.claimScope !== 'complete-prepared-operation'))
    throw new OperationDecisionEvidenceError('Decision estimate differs from its original complete-operation claim');
  /** Function diagnostics retain the model-independent lifecycle boundary. */
  const rl = tagged({ tag: resolveOperationDecision.name, l });
  if ((answer?.status !== 'estimate') || ((typeof answer.value) === 'number')) {
    rl.debug('whole-operation decision has no usable categorical estimate');
    return Object.freeze({ state: 'unresolved', reason: 'The decision model did not return a usable decision for the complete operation' });
  }
  if (record.model !== ruleAssessmentModel)
    throw new OperationDecisionEvidenceError('Operation decision lacks the configured serving-model attribution');
  if (!admitsOperatingChoice({ value: answer.value, labels: operationDecisionLabels })) {
    rl.debug('whole-operation decision remains uncertain under the adopted cutoff');
    return Object.freeze({ state: 'unresolved', reason: 'The decision model could not resolve the complete operation with the current instructions and user authorization' });
  }
  /** Only the fixed terminal vocabulary can authorize execution or deny the operation. */
  const { choice } = answer.value;
  if ((choice !== 'approve') && (choice !== 'deny'))
    throw new OperationDecisionEvidenceError('Admitted operation decision has no implemented terminal verdict');
  rl.debug(`whole-operation model decision: ${choice}`);
  return Object.freeze({
    state: 'resolved',
    verdict: choice,
    reason: choice === 'approve'
      ? 'The decision model approved the complete operation under the current instructions and user request'
      : 'The decision model found an applicable restriction or required authorization missing for the complete operation',
  });
}

/**
 Ask the configured decision model once after clause resolution leaves the operation undecided.

 @param judgment - original prepared operation and its existing assessment budget

 @returns decision and retained original evidence for currentness and audit checks

 @throws OperationDecisionEvidenceError for an incomplete or foreign evidence set
 */
export async function reviewOperationDecision(judgment: Pick<JudgmentPublicAPI,
  'claimOperationDecision' | 'issue' | 'assess' | 'captureBatchEvidence' | 'assertBatchEvidence'
  | 'assertDependenciesCurrent' | 'checkpoint'>): Promise<Readonly<{
  outcome: GuardOutcome;
  evidence: readonly QuestionEvidence[];
}>> {
  tagged({ tag: reviewOperationDecision.name, l }).debug('asking decision model to resolve complete prepared operation');
  judgment.assertDependenciesCurrent();
  judgment.checkpoint();
  /** The original declaration cannot be sampled again through a different handle. */
  const batch = judgment.issue([judgment.claimOperationDecision()]);
  await judgment.assess(batch);
  /** Original evidence is authenticated before inspecting any provider-selected value. */
  const evidence = judgment.captureBatchEvidence(batch);
  judgment.assertBatchEvidence(evidence);
  if (evidence.length !== 1)
    throw new OperationDecisionEvidenceError('Whole-operation decision requires exactly its original selected claim');
  /** Array length is checked independently of the retained original member. */
  const record = evidence[0];
  if (record === undefined)
    throw new OperationDecisionEvidenceError('Whole-operation decision evidence is absent');
  return Object.freeze({ outcome: resolveOperationDecision(record), evidence });
}

//endregion Original model fallback
