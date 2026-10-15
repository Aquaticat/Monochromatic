/**
 Original question-selection owner composes declaration, issuance, settlement, and evidence. @module
 */
import { readQuestionDefinitions } from './selection-definitions.ts';
import { createSelectionOwner } from './selection-ownership.ts';
import { createClaimDeclaration } from './selection-declaration.ts';
import { createQuestionIssuance } from './selection-issuance.ts';
import { createQuestionSettlement } from './selection-settlement.ts';
import {
  createQuestionEvidence,
  type QuestionEvidenceOperations
} from './selection-evidence.ts';
import {
  createQuestionInspection,
  type QuestionInspection
} from './selection-inspection.ts';
import type { QuestionSelectionInput } from './selection-owner-types.ts';
import type {
  QuestionSettlementInput,
  QuestionSettlementRecord
} from './selection-settlement-types.ts';

/**
 Frozen public operations retain the original owner for every opaque handle.
 */
export type QuestionSelection = QuestionEvidenceOperations & QuestionInspection
  & ReturnType<typeof createQuestionIssuance> & Readonly<{
    declare: ReturnType<typeof createClaimDeclaration>;
    settle: (input: QuestionSettlementInput) => QuestionSettlementRecord;
  }>;

//region Fixed catalog data and judgment-local claim issuance never establish permission.
/**
 Bind original catalog bytes, occurrence resolution, and judgment lifetime.
 
 @param catalogText - untrusted exact pinned definition bytes
 
 @param catalogSHA256 - expected digest for original definitions
 
 @param budget - original enclosing judgment lifetime
 
 @param resolveBinding - trusted synchronous side-effect-free occurrence resolver
 
 @param envelope - frozen original judgment projection
 
 @returns immutable original selection API
 
 @throws QuestionSelectionError for invalid catalog or envelope admission
 
 @example createQuestionSelection({ catalogText, catalogSHA256, budget, resolveBinding, envelope });
 */
export function createQuestionSelection({
  catalogText,
  catalogSHA256,
  budget,
  resolveBinding,
  envelope = Object.freeze({}),
}: QuestionSelectionInput): QuestionSelection {
  budget.checkpoint();
  /**
   Validate all catalog inputs before constructing the original ownership boundary.
   */
  const catalog = readQuestionDefinitions({
    catalogText,
    catalogSHA256,
    resolveBinding,
    envelope
  });
  /**
   Shared ownership retains reentry, identity, and lifetime checks for every operation.
   */
  const owner = createSelectionOwner({
    budget,
    resolveBinding
  });
  /**
   Fixed predicate membership determines canonical claim declaration.
   */
  const declare = createClaimDeclaration({
    owner,
    catalog
  });
  /**
   Original issuance bounds the complete request before publishing claims.
   */
  const {
    issue,
    requestFor
  } = createQuestionIssuance({
    owner,
    digest: catalog.digest,
    envelope
  });
  /**
   Settlement can update only original owner-local claim and batch records.
   */
  const settle = createQuestionSettlement(owner);
  /**
   Current answer reads remain distinct from historical diagnostic reads.
   */
  const {
    answerFor,
    resultFor,
    inspectClaim,
    inspectBatch,
    discard
  } = createQuestionInspection(owner);
  /**
   Captured evidence retains original identity and never grants semantic authority.
   */
  const {
    captureEvidence,
    assertCapturedIdentity,
    assertCapturableBatch,
    captureBatchEvidence,
    assertCapturedBatchIdentity
  } = createQuestionEvidence({
    owner,
    envelope
  });
  budget.checkpoint();
  return Object.freeze({
    declare,
    issue,
    requestFor,
    settle,
    answerFor,
    resultFor,
    inspectClaim,
    inspectBatch,
    discard,
    captureEvidence,
    assertCapturedIdentity,
    assertCapturableBatch,
    captureBatchEvidence,
    assertCapturedBatchIdentity,
  });
}
//endregion
