/**
 Native policy consumers share the package implementation without loading the extension's SDK entry.

 @module
 */

//region Native consumers import only policy, observation, transport, and approval boundaries.

export { askUser } from './ask-user.ts';
export {
  registerNativeBypass,
  readNativeBypassEnabled
} from './native-bypass.ts';
export { createAssessmentSender } from './assessment-sender.ts';
export { maximumQuestions } from './decision-request.ts';
export { createNativeSemanticOperatingPolicies } from './semantic-operating-policy.ts';
export { VERDICT_ENTRY_TYPE } from './types.ts';
export { AuthorizationEvidenceError } from './authorization-evidence-data.ts';
export {
  captureAuthorizationInputs,
  captureAuthorizationOwnerFactory
} from './authorization-evidence.ts';
export { MISSING_AUTHORIZATION_EVIDENCE } from './authorization-evidence-types.ts';
export {
  assertOriginalInputBudget,
  InputReceiptBudgetError
} from './input-receipt-budget.ts';
export { resolveInstructionEffects } from './instruction-resolution.ts';
export {
  InstructionResolutionInputError,
  flushPolicyDiagnostics
} from './policy-data.ts';
export { inspectAuthorizationRequirements } from './authorization-requirements.ts';
export { resolveGuardOutcome } from './guard-outcome.ts';
export {
  lowerEstablishedClause,
  CLAUSE_RELATIONS
} from './clause-lowering.ts';
export { createNativeQueryObservation } from './native-query-observation.ts';
export {
  installNativePolicyHooks,
  NativePolicyRuntimeError
} from './native-runtime-hooks.ts';
export { consumeRequestMaterial } from './request-material.ts';
export { retainRequestMaterialObligations } from './request-material-obligations.ts';
export { SemanticAdmissionPolicyError } from './semantic-admission-error.ts';
export { copySemanticAdmissionPolicy } from './semantic-admission-policy.ts';
export {
  inspectSemanticAdmissionScope,
  matchesSemanticProgramProfile
} from './semantic-admission-scope.ts';
export { consumeHeadingContexts } from './heading-context.ts';
export { consumeUnitAdoptions } from './unit-adoption.ts';
export { selectUnitAdoptionPairs } from './unit-adoption-profile.ts';
export { UnitAdoptionBindingError } from './unit-adoption-binding.ts';
export { consumeSourceAssociations } from './source-contribution.ts';
export { PolicyInputBindingError } from './policy-input-binding-error.ts';

//endregion
