/**
 Auto-mode named package exports.
 
 @module
 */

export {
  BYPASS_ALLOW_KIND,
  BYPASS_ALLOW_REASON,
  BYPASS_ENTRY_TYPE,
  BYPASS_SHORTCUT,
  BYPASS_SOURCE_SHORTCUT,
  BYPASS_STATUS_KEY,
  BYPASS_STATUS_TEXT,
  BYPASS_TOGGLE_KIND,
} from './bypass.ts';
/**
 Approval boundary exported for built-artifact verification.

 @internal
 */
export {
  askUser,
  notifyAsk,
  updateWidget,
} from './ask-user.ts';

export { buildVisibleContext, } from './visible-context.ts';
export {
  registerNativeBypass,
  readNativeBypassEnabled,
} from './native-bypass.ts';





export {
  buildApprovalFingerprint,
  serializeToolInputForJudge,
} from './tool-helpers.ts';
export {
  DEFAULT_DENY_GUIDANCE,
  JUDGE_SYSTEM_PROMPT,
} from './system-prompt.ts';
export {
  CALLER_SCOPED_YDOTOOL_REASON,
  guardVirtualInput,
  hasCallerScopedYdotool,
} from './virtual-input-guard.ts';
export {
  type VerdictData,
  VERDICT_ENTRY_TYPE,
} from './types.ts';

//region Deterministic migration kernel remains separate from native evidence admission

export {
  AssessmentTransportError,
  createAssessmentHttpSender,
  type AssessmentTransportInput,
} from './assessment-transport.ts';
export { createAssessmentSender, } from './assessment-sender.ts';
export { DecisionWireError, } from './decision-data.ts';
export { encodeDecisionRequest, } from './decision-request.ts';
export { decodeDecisionResponse, } from './decision-response.ts';
export {
  createNativeSemanticOperatingPolicies,
  type NativeSemanticOperatingPolicies,
} from './semantic-operating-policy.ts';
export { type AuthorizationRequirement, } from './authorization-requirement.ts';
export { AuthorizationEvidenceError, } from './authorization-evidence-data.ts';
export { MISSING_AUTHORIZATION_EVIDENCE, } from './authorization-evidence-types.ts';
export {
  captureAuthorizationInputs,
  captureAuthorizationOwnerFactory,
} from './authorization-evidence.ts';
export type {
  AuthorizationEvidenceInputs,
  AuthorizationEvidenceRecord,
  AuthorizationFacts,
  AuthorizationInputSources,
  AuthorizationOwnerContext,
  AuthorizationOwnerFactory,
  AuthorizationSourceView,
} from './authorization-evidence-types.ts';
export {
  CLAUSE_RELATIONS,
  type ClauseRelation,
  type LoweredClause,
  lowerEstablishedClause,
} from './clause-lowering.ts';
export { inspectAuthorizationRequirements, } from './authorization-requirements.ts';
export {
  type GuardOutcome,
  resolveGuardOutcome,
} from './guard-outcome.ts';
export {
  type InstructionResolution,
  resolveInstructionEffects,
} from './instruction-resolution.ts';
export {
  type InstructionApplicability,
  type InstructionEffect,
  type InstructionRule,
} from './instruction-rule.ts';
export {
  flushPolicyDiagnostics,
  InstructionResolutionInputError,
} from './policy-data.ts';

export {
  assertOriginalInputBudget,
  InputReceiptBudgetError,
} from './input-receipt-budget.ts';

export { SemanticAdmissionPolicyError, } from './semantic-admission-error.ts';
export { copySemanticAdmissionPolicy, } from './semantic-admission-policy.ts';
export {
  inspectSemanticAdmissionScope,
  matchesSemanticProgramProfile,
  matchesSemanticOperationProfile,
} from './semantic-admission-scope.ts';
export type {
  SemanticAcceptance,
  SemanticAdmissionDefinition,
  SemanticAdmissionInputs,
  SemanticAdmissionPolicy,
  SemanticAdmissionScope,
} from './semantic-admission-types.ts';
export { PolicyInputBindingError, } from './policy-input-binding-error.ts';
export { consumeSourceAssociations, } from './source-contribution.ts';
export type {
  ContributionCarrier,
  ContributionPublication,
  ContributionRequestObservation,
  ContributionMessageRun,
  ContributionRun,
  ContributionRunCarrier,
  ContributionSource,
  ContributionSourceView,
  RetainedContributionOrigin,
  SourceContribution,
  SourceContributionAssociation,
  SourceContributionInputs,
} from './source-contribution-types.ts';
export type {
  SourceContributionIssue,
  SourceContributionResult,
  SourceContributionUse,
} from './source-contribution-result.ts';
export { consumeUnitAdoptions, } from './unit-adoption.ts';
export { selectUnitAdoptionPairs, } from './unit-adoption-profile.ts';
export {
  UnitAdoptionBindingError,
  type UnitAdoptionEvidence,
  type UnitAdoptionPair,
  type UnitRuleProjection,
} from './unit-adoption-binding.ts';
export type {
  UnitAdoptionInputs,
  UnitAdoptionInterpretation,
  UnitAdoptionResult,
  UnitAuthority,
  UnitClauseInterpretation,
  UnitRegisteredAuthority,
  UnitSourceView,
} from './unit-adoption-types.ts';
export { consumeHeadingContexts, } from './heading-context.ts';
export type {
  HeadingContentEstimate,
  HeadingContentRelation,
  HeadingContextAdmission,
  HeadingContextEvidence,
  HeadingContextInterpretation,
} from './heading-context-types.ts';
export { consumeRequestMaterial, } from './request-material.ts';
export { retainRequestMaterialObligations, } from './request-material-obligations.ts';
export type {
  RequestMaterialAdmission,
  RequestMaterialEstimateValue,
  RequestMaterialEvidence,
  RequestMaterialInputs,
  RequestMaterialInterpretation,
  RequestMaterialJudgment,
  RequestMaterialPremiseIssue,
  RequestMaterialRelation,
} from './request-material-types.ts';

//endregion Deterministic migration kernel

//region Native observation mechanisms do not authenticate frames or authorize execution

export {
  createNativeQueryObservation,
  type NativeQueryCapture,
  type NativeQueryObservation,
} from './native-query-observation.ts';

export {
  installNativePolicyHooks,
  NativePolicyRuntimeError,
  type NativePolicyAgentSlots,
  type NativePolicyHookInstallation,
  type NativePolicyHookRegistration,
} from './native-runtime-hooks.ts';

//endregion Native observation mechanisms

//region Internal verification exports exercise the same bundled policy as Pi

/**
 @internal
 */

/**
 @internal
 */

/**
 @internal
 */

/**
 @internal
 */

/**
 @internal
 */

/**
 @internal
 */
export { formatModelBlockReason, } from './model-feedback.ts';
/**
 @internal
 */

/**
 @internal
 */

/**
 @internal
 */

/**
 @internal
 */


//endregion Internal verification exports
