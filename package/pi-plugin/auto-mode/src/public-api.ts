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
export { findBudgetModel, } from './budget-model.ts';
export {
  buildContext,
  buildProjectContext,
  getReusableApproval,
  getTrustDirectives,
  type ProjectContextFile,
} from './context.ts';
export {
  callJudge,
  EmptyJudgeResponseError,
  extractJsonVerdict,
  parseVerdict,
} from './judge.ts';
export {
  createJudgeCallHistory,
  type JudgeCallHistory,
  type JudgeCallOutcome,
} from './judge-call-history.ts';
export { callJudgeWithFallback, } from './judge-fallback.ts';
export {
  toolChoiceForApi,
  VERDICT_TOOL,
} from './judge-tool.ts';
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
  type BudgetModel,
  type VerdictData,
  VERDICT_ENTRY_TYPE,
  TRUST_ENTRY_TYPE,
  type SignalContext,
} from './types.ts';

//region Deterministic migration kernel remains separate from native evidence admission

export { type AuthorizationRequirement, } from './authorization-requirement.ts';
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
export { analyzeBashCommand, } from './command-parser.ts';
/**
 @internal
 */
export { looksLikePath, } from './command-refs.ts';
/**
 @internal
 */
export {
  contentSignals,
  textSignals,
} from './content-signals.ts';
/**
 @internal
 */
export {
  decisionForDenyVerdict,
  evaluate,
} from './evaluate.ts';
/**
 @internal
 */
export { linkedWorktreeReadAllowlistedDirs, } from './git-worktree-read-allowlist.ts';
/**
 @internal
 */
export { formatModelBlockReason, } from './model-feedback.ts';
/**
 @internal
 */
export {
  isHomeDotfile,
  isUnder,
  pathSignals,
  resolvePath,
} from './path-signals.ts';
/**
 @internal
 */
export { registerProposeTrust, } from './register-propose-trust.ts';
/**
 @internal
 */
export {
  bashSignals,
  hasFlag,
  shouldFlag,
} from './signals.ts';
/**
 @internal
 */
export {
  agentTempAllowlistedDirs,
  isTrustedAgentTempDir,
} from './temp-allowlist.ts';

//endregion Internal verification exports
