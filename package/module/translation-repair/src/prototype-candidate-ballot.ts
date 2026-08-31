// PROTOTYPE ONLY: Candidate I candidate-scoped ballot calibration surface.

export {
  admitCandidateBallotAuthorResponse,
  assertCandidateBallotBinding,
} from './prototype-candidate-ballot-author.ts';
export {
  admitCandidateBallotResponse,
} from './prototype-candidate-ballot-admission.ts';
export {
  CONDITIONAL_DEFECT_CLASSES,
} from './prototype-conditional-audit-model.ts';
export {
  candidateBallotResponseGuard,
  diagnoseCandidateBallotResponse,
} from './prototype-candidate-ballot-guard.ts';
export {
  CANDIDATE_BALLOT_HYPER_MODELS,
  candidateBallotHyperModel,
  candidateBallotHyperRouteDigest,
  createCandidateBallotHyperClient,
  type CandidateBallotHyperModel,
} from './prototype-candidate-ballot-hyper.ts';
export {
  assertCandidateBallotManifest,
  candidateBallotLedgerDigest,
  createCandidateBallotManifest,
} from './prototype-candidate-ballot-manifest.ts';
export {
  CANDIDATE_BALLOT_AUTHOR_COUNT,
  CANDIDATE_BALLOT_FINDING_CAP,
  CANDIDATE_BALLOT_VERIFIER_COUNT,
  MAX_CANDIDATE_BALLOT_PAYLOAD_COUNT,
  type CandidateBallotAuthorSettlement,
  type CandidateBallotCandidate,
  type CandidateBallotDiagnosis,
  type CandidateBallotGuardFailure,
  type CandidateBallotManifest,
  type CandidateBallotResponse,
  type CandidateBallotSelection,
  type CandidateBallotStatusRow,
  type CandidateBallotVerifierPlan,
  type CandidateScopedBallot,
} from './prototype-candidate-ballot-model.ts';
export {
  bindCandidateBallotClient,
  type CandidateBallotClient,
  type CandidateBallotProviderClients,
} from './prototype-candidate-ballot-runtime-support.ts';
export {
  runCandidateBallotRuntime,
  type CandidateBallotRuntimeResult,
} from './prototype-candidate-ballot-runtime.ts';
export {
  candidateBallotResponseFormat,
} from './prototype-candidate-ballot-schema.ts';
export {
  selectCandidateBallot,
} from './prototype-candidate-ballot-selection.ts';
export {
  assertTargetBoundariesBindShell,
  targetBoundariesForShell,
} from './prototype-target-boundary.ts';
export {
  buildRealizationObligationLedger,
} from './prototype-realization-ledger.ts';
export type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
  RealizationTargetAnchor,
} from './prototype-realization-model.ts';
export {
  REALIZATION_GLOBAL_CRITERIA,
} from './prototype-realization-model.ts';
export {
  compileCandidateBallotCandidate,
  compileCandidateBallotDocument,
} from './prototype-target-boundary-compile.ts';
export type {
  CandidateBallotCompilation,
  CandidateTargetBoundary,
  ResolvedCandidateTargetBoundary,
} from './prototype-target-boundary.ts';
export {
  buildImmutableShell,
} from './prototype-slot-shell.ts';
