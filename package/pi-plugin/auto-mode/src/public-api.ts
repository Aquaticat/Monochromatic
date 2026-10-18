/**
 Auto-mode named package exports.
 
 @module
 */
export * from './native-policy-api.ts';


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
  notifyAsk,
  updateWidget,
} from "./ask-user.ts";








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
} from "./types.ts";

//region Deterministic migration kernel remains separate from native evidence admission

export {
  AssessmentTransportError,
  createAssessmentHttpSender,
  type AssessmentTransportInput,
} from './assessment-transport.ts';

export { DecisionWireError, } from './decision-data.ts';
export { encodeDecisionRequest, } from './decision-request.ts';
export { decodeDecisionResponse, } from './decision-response.ts';
export {
  type NativeSemanticOperatingPolicies,
} from "./semantic-operating-policy.ts";
export { type AuthorizationRequirement, } from './authorization-requirement.ts';



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
  type ClauseRelation,
  type LoweredClause,
} from "./clause-lowering.ts";

export {
  type GuardOutcome,
} from "./guard-outcome.ts";
export {
  type InstructionResolution,
} from "./instruction-resolution.ts";
export {
  type InstructionApplicability,
  type InstructionEffect,
  type InstructionRule,
} from './instruction-rule.ts';







export type {
  SemanticAcceptance,
  SemanticAdmissionDefinition,
  SemanticAdmissionInputs,
  SemanticAdmissionPolicy,
  SemanticAdmissionScope,
} from './semantic-admission-types.ts';


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


export {
  type UnitAdoptionEvidence,
  type UnitAdoptionPair,
  type UnitRuleProjection,
} from "./unit-adoption-binding.ts";
export type {
  UnitAdoptionInputs,
  UnitAdoptionInterpretation,
  UnitAdoptionResult,
  UnitAuthority,
  UnitClauseInterpretation,
  UnitRegisteredAuthority,
  UnitSourceView,
} from './unit-adoption-types.ts';

export type {
  HeadingContentEstimate,
  HeadingContentRelation,
  HeadingContextAdmission,
  HeadingContextEvidence,
  HeadingContextInterpretation,
} from './heading-context-types.ts';


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
  type NativeQueryCapture,
  type NativeQueryObservation,
} from "./native-query-observation.ts";

export {
  type NativePolicyAgentSlots,
  type NativePolicyHookInstallation,
  type NativePolicyHookRegistration,
} from "./native-runtime-hooks.ts";

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
