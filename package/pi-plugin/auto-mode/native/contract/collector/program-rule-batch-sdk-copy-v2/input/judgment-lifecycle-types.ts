/**
 Original judgment lifecycle contracts retain evidence closure, transport attempts, and terminal diagnostics. @module
 */
import type { JudgmentBudget, JudgmentBudgetSnapshot, JudgmentAttempt } from '../../../lifecycle/judgment-budget-error-occurrences/controls-private/types.ts';
import type { QuestionSelection } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner.ts';
import type { QuestionRequest } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner-types.ts';

/** Successful original evidence closure does not establish policy, instruction authority, or permission. */
export type JudgmentEvidenceClosure = Readonly<{
  evidenceOnly: true;
  status: 'evidence-closed';
  policyVerdict: 'not-established';
  instructionAuthority: 'not-established';
  humanPermission: false;
  dependencies: unknown;
  accounting: JudgmentBudgetSnapshot;
  parentJSON: string;
  batches: readonly ReturnType<QuestionSelection['resultFor']>[];
}>;

/** Failed closure retains original failure and batch inspection without implying live eligibility. */
export type JudgmentClosureFailure = Readonly<{
  retainedOnly: true;
  status: 'close-failed';
  failure: unknown;
  accounting: JudgmentBudgetSnapshot;
  batches: readonly ReturnType<QuestionSelection['inspectBatch']>[];
}>;

/** Shared private lifecycle state preserves operation guards and original closure outcomes. */
export type JudgmentLifecycleState = {
  operating: boolean;
  assessing: boolean;
  finished: boolean;
  closeFailed: boolean;
  finalRecord?: JudgmentEvidenceClosure | JudgmentClosureFailure;
};

/** Original judgment capabilities remain lazy until their corresponding operation boundary. */
export type JudgmentLifecycleInput = Readonly<{
  knownSelection: () => QuestionSelection;
  ready: () => void;
  active: () => void;
  bindingSegment: <Result>(run: () => Result) => Result;
  assertDependenciesCurrent: () => void;
  budget: JudgmentBudget;
  finalizeDependencies: (handle: object) => unknown;
  readDependencyHandle: () => object;
  parentJSON: string;
  send: (input: JudgmentAttempt & Readonly<{ request: QuestionRequest }>) => Promise<unknown>;
}>;

/** Original issued and attempted memberships are separate from copied batch metadata. */
export type JudgmentLifecycleContext = Readonly<{
  input: JudgmentLifecycleInput;
  state: JudgmentLifecycleState;
  issuedBatches: Set<object>;
  attemptedBatches: WeakSet<object>;
}>;

/** Evidence operations preserve original membership-first and currentness check ordering. */
export type JudgmentEvidenceOperations = Readonly<{
  captureBatchEvidence: (batch: object) => ReturnType<QuestionSelection['captureBatchEvidence']>;
  assertBatchEvidence: QuestionSelection['assertCapturedBatchIdentity'];
  captureClaimEvidence: QuestionSelection['captureEvidence'];
  assertClaimEvidence: QuestionSelection['assertCapturedIdentity'];
}>;

/** Issuance and assessment retain one original attempt set and one original transport budget. */
export type JudgmentAssessmentOperations = Readonly<{
  issue: QuestionSelection['issue'];
  assess: (batch: object) => Promise<ReturnType<QuestionSelection['settle']>>;
}>;

/** Synchronous public guards and asynchronous assessment share the same original operation exclusion. */
export type JudgmentLifecycle = JudgmentEvidenceOperations & JudgmentAssessmentOperations & Readonly<{
  state: JudgmentLifecycleState;
  operation: <Result>(run: () => Result) => Result;
  finalize: () => JudgmentEvidenceClosure;
}>;
