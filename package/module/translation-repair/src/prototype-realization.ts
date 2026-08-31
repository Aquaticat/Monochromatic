// PROTOTYPE ONLY: Candidate G calibration schema surface.

export {
  admitRealizationAuthorResponse,
} from './prototype-realization-admission.ts';
export {
  candidatesFromRealizationAuthorSettlement,
  type RealizationAuthorSettlement,
  type RealizationAuthorSettlementRow,
} from './prototype-realization-author-settlement.ts';
export {
  realizationAuthorResponseFormat,
  realizationAuthorResponseGuard,
  realizationCandidateAlias,
} from './prototype-realization-author.ts';
export {
  assertNoDuplicateJsonMembers,
} from './prototype-json-member-guard.ts';
export {
  normalizeRealizationLineEndings,
} from './prototype-realization-coordinate.ts';
export {
  runRealizationNodeLifecycleControls,
} from './prototype-realization-node-lifecycle-controls.ts';
export {
  buildRealizationObligationLedger,
} from './prototype-realization-ledger.ts';
export {
  assertRealizationLedgerBindsShell,
  assertRealizationObligationLedger,
} from './prototype-realization-ledger-validation.ts';
export {
  realizationObligationEvidenceDigest,
} from './prototype-realization-obligation.ts';
export type {
  RealizationAuthorResponse,
  RealizationCandidatePlan,
  RealizationCandidateVerification,
  RealizationFinding,
  RealizationManifest,
  RealizationObligation,
  RealizationObligationLedger,
  RealizationProviderSelection,
  RealizationSelection,
  RealizationTargetAnchor,
  RealizationVerifierBallot,
  RealizationVerifierResponse,
  RealizedCandidate,
} from './prototype-realization-model.ts';
export {
  assertRealizationCandidatesAuthorizedByManifest,
  assertRealizationManifest,
  createRealizationManifest,
  realizationLedgerDigest,
} from './prototype-realization-manifest.ts';
export {
  MAX_REALIZATION_CANDIDATES,
  MAX_REALIZATION_FINDING_ANCHORS,
  MAX_REALIZATION_FINDINGS,
  MAX_REALIZATION_OBLIGATIONS,
  MAX_REALIZATION_RELATION_ENDPOINTS,
  MAX_REALIZATION_SOURCE_SPAN_LENGTH,
  MAX_REALIZATION_SOURCE_SPANS,
  MAX_REALIZATION_TARGET_ANCHORS,
  MAX_REALIZATION_VERIFIERS,
  REALIZATION_GLOBAL_CRITERIA,
} from './prototype-realization-model.ts';
export {
  runRealizationRuntimeControls,
} from './prototype-realization-runtime-controls.ts';
export {
  bindRealizationClient,
  runRealizationRuntime,
  type RealizationBoundClient,
  type RealizationProviderClients,
  type RealizationRuntimeResult,
} from './prototype-realization-runtime.ts';
export {
  selectRealizationCandidate,
} from './prototype-realization-selection.ts';
export {
  buildImmutableShell,
} from './prototype-slot-shell.ts';
export {
  admitRealizationVerifierResponse,
} from './prototype-realization-verifier-admission.ts';
export {
  realizationVerifierResponseFormat,
} from './prototype-realization-verifier-schema.ts';
export {
  realizationVerifierResponseGuard,
} from './prototype-realization-verifier.ts';
