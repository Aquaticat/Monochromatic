/**
 Independent original public method ordering and invocation contracts. @module
 */

/**
 Public names are recorded independently from the extracted implementation.
 */
export const publicKeys = [
  'bindPreparedProgram',
  'preparedProgramFor',
  'openProgram',
  'programFor',
  'reachProgramGroup',
  'reachedGroupFor',
  'bindProgramCalls',
  'prepareReachedMembers',
  'scriptValueFor',
  'markProgramGuard',
  'inspectReachedGroup',
  'originalFileFor',
  'preparedMemberFor',
  'assertExecutionEntry',
  'executionEntryFor',
  'inspectProgram',
  'memberFor',
  'beginExecution',
  'executionFor',
  'finishExecution',
  'inspectExecution',
  'checkpoint',
  'prepare',
  'claim',
  'claimInstruction',
  'captureClaimEvidence',
  'assertClaimEvidence',
  'readSourceSnapshot',
  'readCurrentSourceBinding',
  'indexedUnitAdoptionPairs',
  'claimUnitAdoption',
  'requestMaterialFor',
  'claimRequestMaterial',
  'claimHeadingContext',
  'claimOperationDecision',
  'issueBoundPolicyBatch',
  'indexedRuleCandidates',
  'indexedInstructionCandidates',
  'indexedHeadingContextCandidates',
  'inspectRuleSources',
  'readPolicySelection',
  'issueRuleAssessmentBatch',
  'readRuleCandidate',
  'claimRuleCandidate',
  'claimProgramRuleCandidate',
  'issueProgramRuleBatch',
  'captureBatchEvidence',
  'assertBatchEvidence',
  'issue',
  'assess',
  'finalize',
  'assertDependenciesCurrent',
  'inspect',
  'inspectBatch',
  'inspectClaim',
] as const;

/**
 Direct owners retain identity and accept the caller's original argument list.
 */
export const directKeys = [
  'scriptValueFor',
  'inspectReachedGroup',
  'inspectProgram',
  'inspectExecution',
  'readSourceSnapshot',
  'assess',
  'inspect',
] as const;

/**
 No-input guards hand the exact original callback to operation exclusion.
 */
export const noInputKeys = [
  'checkpoint',
  'readCurrentSourceBinding',
  'indexedUnitAdoptionPairs',
  'requestMaterialFor',
  'claimRequestMaterial',
  'claimOperationDecision',
  'indexedRuleCandidates',
  'indexedInstructionCandidates',
  'indexedHeadingContextCandidates',
  'inspectRuleSources',
  'readPolicySelection',
  'issueRuleAssessmentBatch',
  'finalize',
  'assertDependenciesCurrent',
] as const;

/**
 Selection methods resolve the current selection at every public inspection.
 */
export const selectionKeys = [
  'inspectBatch',
  'inspectClaim'
] as const;

/**
 Membership sets categorize independently recorded public keys.
 */
const unguarded = new Set<string>([
  ...directKeys,
  ...selectionKeys
]);
/**
 No-input membership excludes these methods from one-input forwarding cases.
 */
const noInput = new Set<string>(noInputKeys);

/**
 Every remaining public operation must retain exactly one input argument.
 */
export const oneInputKeys: readonly string[] = publicKeys.filter(function oneInput(name) {
  return (!unguarded.has(name)) && (!noInput.has(name));
});
