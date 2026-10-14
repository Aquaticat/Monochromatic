/**
 Consumer declarations for the build-owned maintained package export bridge.

 @module
 */
export {
  askUser,
  createAssessmentSender,
  VERDICT_ENTRY_TYPE,
  AuthorizationEvidenceError,
  captureAuthorizationInputs,
  captureAuthorizationOwnerFactory,
  MISSING_AUTHORIZATION_EVIDENCE,
  assertOriginalInputBudget,
  InputReceiptBudgetError,
  resolveInstructionEffects,
  InstructionResolutionInputError,
  inspectAuthorizationRequirements,
  resolveGuardOutcome,
  lowerEstablishedClause,
  CLAUSE_RELATIONS,
  createNativeQueryObservation,
  installNativePolicyHooks,
  NativePolicyRuntimeError,
  consumeRequestMaterial,
  retainRequestMaterialObligations,
  SemanticAdmissionPolicyError,
  copySemanticAdmissionPolicy,
  inspectSemanticAdmissionScope,
  consumeHeadingContexts,
  consumeUnitAdoptions,
  selectUnitAdoptionPairs,
  UnitAdoptionBindingError,
  consumeSourceAssociations,
  PolicyInputBindingError,
  flushPolicyDiagnostics
} from '../../../src/public-api.ts';

/**
 Original built package entry selected before disposable fixture homes are installed.
 */
export declare const maintainedPolicyEntry: string;

/**
 Original package root owns runtime dependency resolution.
 */
export declare const maintainedPackageRoot: string;
