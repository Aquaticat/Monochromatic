// PROTOTYPE ONLY: Candidate M calibration surface.

export {
  CANDIDATE_M_AUTHOR_PROTOCOL_DIGEST,
  riskAttestedAuthorMessages,
} from './prototype-risk-challenger-author-prompt.ts';
export {
  CANDIDATE_M_RISK_ATTESTATION_DIGEST,
  CANDIDATE_M_RISK_POLICY_DIGEST,
  candidateMRiskAttestations,
  diagnoseRiskAttestedAuthorResponse,
  riskAttestedAuthorGuard,
  riskAttestedAuthorResponseFormat,
} from './prototype-risk-challenger-author-wire.ts';
export {
  admitRiskAttestedAuthorResponse,
  assertRiskAttestedCandidate,
} from './prototype-risk-challenger-author.ts';
export {
  diagnoseRiskFinding,
} from './prototype-risk-challenger-evidence.ts';
export {
  diagnoseRiskChallenge,
  riskChallengeGuard,
} from './prototype-risk-challenger-guard.ts';
export {
  assertCandidateMManifest,
  candidateMNodeTimeout,
  createCandidateMManifest,
} from './prototype-risk-challenger-manifest.ts';
export type {
  CandidateMManifest,
  CandidateMSelection,
} from './prototype-risk-challenger-manifest-model.ts';
export {
  CANDIDATE_M_ARCHITECTURE,
  CANDIDATE_M_AUTHOR_COUNT,
  CANDIDATE_M_AUTHOR_TIMEOUT_MS,
  CANDIDATE_M_CHALLENGER_FAMILY_COUNT,
  CANDIDATE_M_CHALLENGER_ROLES,
  CANDIDATE_M_CHALLENGER_TIMEOUT_MS,
  CANDIDATE_M_DEFECT_CLASSES,
  CANDIDATE_M_GUARD_FAILURES,
  CANDIDATE_M_MANIFEST_VERSION,
  CANDIDATE_M_MAX_FINDING_EVIDENCE,
  CANDIDATE_M_RISK_CODE,
  CANDIDATE_M_RISK_KEYS,
  MAX_CANDIDATE_M_PAYLOAD_COUNT,
  type CandidateMAuthorResponse,
  type CandidateMAuthorState,
  type CandidateMChallenge,
  type CandidateMChallengeDiagnosis,
  type CandidateMChallengeResponse,
  type CandidateMChallengeState,
  type CandidateMChallengerRole,
  type CandidateMCandidate,
  type CandidateMDefectClass,
  type CandidateMFinding,
  type CandidateMGuardFailure,
  type CandidateMRiskAttestations,
  type CandidateMSourceEvidence,
  type CandidateMSourceScope,
} from './prototype-risk-challenger-model.ts';
export {
  assertCandidateMChallengerBinding,
  createCandidateMChallengerPlan,
  type CandidateMChallengerPlan,
  type CandidateMChallengerPlanNode,
} from './prototype-risk-challenger-plan.ts';
export {
  CANDIDATE_M_CHALLENGER_PROTOCOL_DIGEST,
  riskChallengerMessages,
} from './prototype-risk-challenger-prompt.ts';
export {
  CANDIDATE_M_CHALLENGER_RULE_DIGEST,
  CANDIDATE_M_CHALLENGER_RULES,
  CANDIDATE_M_FIDELITY_DEFECT_CLASSES,
  CANDIDATE_M_LANGUAGE_DEFECT_CLASSES,
  CANDIDATE_M_SHARED_DEFECT_CLASSES,
  candidateMDefectClassesForRole,
  candidateMEvidenceCardinality,
  candidateMMinimumImageEvidence,
  candidateMMinimumSourceEvidence,
  candidateMMinimumTargetAnchors,
  candidateMRoleAllows,
  candidateMSourceScopeAllows,
  type CandidateMChallengerRules,
  type CandidateMEvidenceCardinalityRule,
} from './prototype-risk-challenger-rules.ts';
export {
  runCandidateMRuntime,
  type CandidateMRuntimeResult,
} from './prototype-risk-challenger-runtime.ts';
export {
  candidateMChallengeToolName,
  riskChallengeResponseFormat,
} from './prototype-risk-challenger-schema.ts';
export {
  selectCandidateM,
} from './prototype-risk-challenger-selection.ts';
export {
  candidateMCandidates,
  createCandidateMAuthorSettlement,
  type CandidateMAuthorSettlement,
  type CandidateMAuthorSettlementRow,
} from './prototype-risk-challenger-settlement.ts';
export {
  bindReviewUnitClient,
} from './prototype-review-unit-runtime-support.ts';
export {
  buildRealizationObligationLedger,
} from './prototype-realization-ledger.ts';
export {
  buildImmutableShell,
} from './prototype-slot-shell.ts';
export {
  createReviewUnitHyperClient,
} from './prototype-review-unit-hyper.ts';
export {
  createReviewUnitPlan,
} from './prototype-review-unit-plan.ts';
export {
  reviewUnitLedgerDigest,
} from './prototype-review-unit-manifest.ts';
