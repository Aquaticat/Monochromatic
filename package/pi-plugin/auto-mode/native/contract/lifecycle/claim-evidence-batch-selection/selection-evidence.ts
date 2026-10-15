/**
 Retain canonical original evidence without promoting estimates to permission. @module
 */
import { QuestionSelectionError } from './selection-error.ts';
import { object } from './selection-values.ts';
import type {
  QuestionEvidence,
  SelectionBatch,
  SelectionClaim,
  SelectionOwner,
} from './selection-owner-types.ts';

/**
 Identity checks authenticate captured records without implying current dependencies.
 */
export type QuestionEvidenceOperations = Readonly<{
  assertCapturableBatch: (handle: unknown) => void;
  captureBatchEvidence: (handle: unknown) => readonly QuestionEvidence[];
  assertCapturedBatchIdentity: (evidence: unknown) => void;
  captureEvidence: (handle: unknown) => QuestionEvidence;
  assertCapturedIdentity: (input: Readonly<{
    claim: unknown;
    evidence: unknown
  }>) => void;
}>;

/**
 Only issued estimates and explicit uncertainty can become relation evidence.
 
 @param claim - original claim with retained terminal answer
 
 @returns whether the claim lacks usable terminal evidence
 */
function lacksUsableAnswer(claim: SelectionClaim): boolean {
  return (!claim.issued) || ((claim.answer
    ?.status
    !== 'estimate') && (claim.answer
      ?.status
      !== 'unresolved'));
}

/**
 Authenticate complete terminal membership without checking current dependencies.
 
 @param batch - original owner-local issued batch
 
 @throws QuestionSelectionError for incomplete or unusable terminal membership
 */
function assertCompleteBatch(batch: SelectionBatch): void {
  if ((!batch.settled)
    || batch.selected
    .some(lacksUsableAnswer)) throw new QuestionSelectionError('Original batch has no complete usable relation evidence');
}

//region Canonical captures preserve exact original claim and batch identities.
/**
 Bind evidence capture to the original owner and frozen judgment envelope.
 
 @param owner - original membership and lifetime capabilities
 
 @param envelope - retained original judgment projection
 
 @returns canonical capture and retained identity operations
 
 @example createQuestionEvidence({ owner, envelope });
 */
export function createQuestionEvidence({
  owner,
  envelope
}: Readonly<{
  owner: SelectionOwner;
  envelope: unknown;
}>): QuestionEvidenceOperations {
  /**
   Only arrays captured by this owner can authenticate as original batch evidence.
   */
  const batchByEvidence = new WeakMap<object, SelectionBatch>();
  /**
   Retain one immutable evidence object for the original settled claim.
   
   @param claim - admitted original claim whose caller checked capture eligibility
   
   @returns canonical retained evidence without semantic or permission qualification
   */
  function canonicalEvidence(claim: SelectionClaim): QuestionEvidence {
    claim.evidence ??= Object.freeze({
        definitionId: claim.definitionId,
        definition: claim.definition,
        binding: claim.binding
          .projection,
        envelope,
        answer: claim.answer,
        ...(claim.model === undefined ? {} : { model: claim.model }),
        semanticQualification: 'not-established',
        instructionAuthority: 'not-established',
        permission: false,
    });
    return claim.evidence;
  }
  /**
   Authenticate terminal phase without asserting source or lifetime currentness.
   
   @param handle - original issued batch handle
   
   @throws QuestionSelectionError for foreign or unusable batches
   */
  function assertCapturableBatch(handle: unknown): void {
     owner.retainedOperation(function assertCompleteRelationBatch(): void {
      assertCompleteBatch(owner.knownBatch(handle));
    });
  }
  /**
   Capture exact issued membership after checking every original dependency.
   
   @param handle - original issued batch handle
   
   @returns canonical immutable array of original claim evidence
   
   @throws QuestionSelectionError for foreign, incomplete, or changed batches
   */
  function captureBatchEvidence(handle: unknown): readonly QuestionEvidence[] {
    return owner.atomic(function retainCompleteRelationEvidence(): readonly QuestionEvidence[] {
      /**
       Authenticate membership and terminal state before currentness checks.
       */
      const batch = owner.knownBatch(handle);
      assertCompleteBatch(batch);
      for (const claim of batch.selected) owner.current(claim);
      owner.budget
        .checkpoint();
      if (!batch.evidence) {
        batch.evidence = Object.freeze(batch.selected
          .map(canonicalEvidence));
        batchByEvidence.set(
          batch.evidence,
          batch
        );
      }
      owner.budget
        .checkpoint();
      return batch.evidence;
    });
  }
  /**
   Authenticate canonical batch identity independently of original dependency checks.
   
   @param evidence - untrusted evidence array
   
   @throws QuestionSelectionError for copied or foreign captured arrays
   */
  function assertCapturedBatchIdentity(evidence: unknown): void {
     owner.retainedOperation(function assertOriginalBatchEvidence(): void {
      /**
       Equal values do not establish original captured identity.
       */
      const batch = object(evidence) ? batchByEvidence.get(evidence) : undefined;
      if ((!batch) || (batch.evidence !== evidence)) throw new QuestionSelectionError('Relation evidence is not an original captured batch from this judgment');
    });
  }
  /**
   Capture original settled evidence while its original dependencies remain current.
   
   @param handle - original declared claim handle
   
   @returns canonical original evidence record
   
   @throws QuestionSelectionError for foreign, unissued, unusable, or changed claims
   */
  function captureEvidence(handle: unknown): QuestionEvidence {
    return owner.atomic(function retainOriginalClaimEvidence(): QuestionEvidence {
      /**
       Currentness precedes usability exactly as at the original claim boundary.
       */
      const claim = owner.knownClaim(handle);
      owner.current(claim);
      if (lacksUsableAnswer(claim)) throw new QuestionSelectionError('Claim has no usable terminal relation evidence');
      owner.budget
        .checkpoint();
      return canonicalEvidence(claim);
    });
  }
  /**
   Authenticate retained identity without granting dependency eligibility.
   
   @param claim - original declared claim handle
   
   @param evidence - untrusted candidate record
   
   @throws QuestionSelectionError for uncaptured, copied, or foreign claim evidence
   */
  function assertCapturedIdentity({
    claim: handle,
    evidence
  }: Readonly<{
    claim: unknown;
    evidence: unknown
  }>): void {
     owner.retainedOperation(function assertOriginalClaimEvidence(): void {
      /**
       The original claim alone owns its canonical evidence record.
       */
      const claim = owner.knownClaim(handle);
      if ((!claim.evidence) || (claim.evidence !== evidence)) throw new QuestionSelectionError('Relation evidence is not the canonical record for this original claim');
    });
  }
  return {
    assertCapturableBatch,
    captureBatchEvidence,
    assertCapturedBatchIdentity,
    captureEvidence,
    assertCapturedIdentity
  };
}
//endregion
