/**
 Original evidence capture preserves membership authentication before dependency eligibility checks. @module
 */
import { JudgmentConstructionError } from './judgment-error.ts';
import type {
  JudgmentLifecycleContext,
  JudgmentEvidenceOperations
} from './judgment-lifecycle-types.ts';

//region Captured evidence retains original identities without independently granting permission.
/**
 Bind original claim and batch evidence to one judgment's issued membership and currentness boundary.

 @param input - original selection and dependency capabilities

 @param issuedBatches - original judgment-issued batch membership

 @returns original evidence capture and authentication methods

 @example createJudgmentEvidence({ input, issuedBatches, state, attemptedBatches });
 */
export function createJudgmentEvidence({
  input,
  issuedBatches
}: JudgmentLifecycleContext): JudgmentEvidenceOperations {
  /**
   Original callback references are retained without eagerly reading selection or eligibility.
   */
  const {
    knownSelection,
    ready,
    bindingSegment,
    assertDependenciesCurrent
  } = input;
  /**
   Authenticate original batch and terminal phase before retaining any eligibility failure.

   @param batch - original issued batch occurrence

   @returns original canonical captured batch evidence

   @throws JudgmentConstructionError for a batch not issued by this judgment
   */
  function captureBatchEvidence(batch: object): ReturnType<JudgmentEvidenceOperations['captureBatchEvidence']> {
    if (!issuedBatches.has(batch)) throw new JudgmentConstructionError('Question batch is not owned by this judgment');
    knownSelection()
      .assertCapturableBatch(batch);
    return bindingSegment(function readBatchEvidence() { 
      return knownSelection()
        .captureBatchEvidence(batch); 
    });
  }
  /**
   Authenticate exact retained batch identity before observing current dependencies.

   @param evidence - candidate original captured batch evidence
   */
  function assertBatchEvidence(evidence: unknown): void {
    knownSelection()
      .assertCapturedBatchIdentity(evidence);
    assertDependenciesCurrent();
  }
  /**
   Require original readiness before capturing a claim's canonical evidence.

   @param claim - original declared claim occurrence

   @returns original canonical claim evidence
   */
  function captureClaimEvidence(claim: unknown): ReturnType<JudgmentEvidenceOperations['captureClaimEvidence']> {
    ready();
    return knownSelection()
      .captureEvidence(claim);
  }
  /**
   Authenticate exact retained claim identity before observing current dependencies.

   @param evidence - original claim and candidate canonical evidence
   */
  function assertClaimEvidence(evidence: Parameters<JudgmentEvidenceOperations['assertClaimEvidence']>[0]): void {
    knownSelection()
      .assertCapturedIdentity(evidence);
    assertDependenciesCurrent();
  }
  return {
    captureBatchEvidence,
    assertBatchEvidence,
    captureClaimEvidence,
    assertClaimEvidence
  };
}
//endregion
