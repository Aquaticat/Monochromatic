// PROTOTYPE ONLY: Candidate H bounded-verdict calibration surface.

export {
  admitBoundedAuthorResponse,
  assertBoundedCandidateBinding,
} from './prototype-bounded-verdict-author.ts';
export {
  admitBoundedVerifierResponse,
} from './prototype-bounded-verdict-admission.ts';
export {
  CONDITIONAL_DEFECT_CLASSES,
} from './prototype-conditional-audit-model.ts';
export {
  BOUNDED_HYPER_COMPLETION_CEILING,
  maximalBoundedVerifierResponse,
  measureBoundedVerifierEnvelope,
  type BoundedEnvelopeMeasurement,
} from './prototype-bounded-verdict-envelope.ts';
export {
  assertBoundedCandidatesAuthorized,
  assertBoundedVerdictManifest,
  boundedLedgerDigest,
  createBoundedVerdictManifest,
} from './prototype-bounded-verdict-manifest.ts';
export {
  BOUNDED_AUTHOR_COUNT,
  BOUNDED_VERDICT_FINDING_CAP,
  MAX_BOUNDED_PAYLOAD_COUNT,
  type BoundedAuthorSettlement,
  type BoundedCandidate,
  type BoundedCandidateVerification,
  type BoundedFinding,
  type BoundedSelection,
  type BoundedVerifierBallot,
  type BoundedVerifierResponse,
  type BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
export {
  bindBoundedClient,
  type BoundedClient,
  type BoundedProviderClients,
} from './prototype-bounded-verdict-runtime-support.ts';
export {
  runBoundedRuntime,
  type BoundedRuntimeResult,
} from './prototype-bounded-verdict-runtime.ts';
export {
  selectBoundedCandidate,
} from './prototype-bounded-verdict-selection.ts';
export {
  boundedVerifierResponseGuard,
} from './prototype-bounded-verdict-verifier-guard.ts';
export {
  boundedVerifierResponseFormat,
} from './prototype-bounded-verdict-verifier-schema.ts';
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
  buildImmutableShell,
} from './prototype-slot-shell.ts';
