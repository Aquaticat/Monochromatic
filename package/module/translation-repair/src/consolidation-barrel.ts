//region Consolidation barrel
// Third rendering, its fidelity gate, final body polish, cache and artifact records.

export { renderConsolidationBrief, } from './consolidate-brief.ts';
export { applyFinalPolish, } from './consolidation-polish-apply.ts';
export {
  ABSOLUTE_NATURALNESS_CONFIRMATIONS_REQUIRED,
  type ConfirmedAbsoluteNaturalness,
  confirmAbsoluteNaturalness,
} from './absolute-naturalness-confirmation.ts';
export {
  type AbsoluteNaturalnessReviewOutcome,
  type AbsoluteNaturalnessReviewSeat,
  type AbsoluteNaturalnessReviewVerdict,
  reviewAbsoluteNaturalness,
} from './absolute-naturalness-review-stage.ts';
export {
  ABSOLUTE_NATURALNESS_REVIEW_RESPONSE_FORMAT,
  type AbsoluteNaturalnessFinding,
  type AbsoluteNaturalnessReviewPerspective,
  type AbsoluteNaturalnessReviewSubject,
  type AbsoluteNaturalnessReviewWire,
  buildAbsoluteNaturalnessReviewMessages,
  isAbsoluteNaturalnessReviewWire,
} from './absolute-naturalness-review-wire.ts';
export {
  CONSOLIDATE_GATE_QUORUM,
  type ConsolidateGateOutcome,
  gateConsolidatedSlice,
  type GateShipped,
  settleGateBallots,
} from './consolidate-gate-stage.ts';
export {
  floorConsolidateSlate,
  type ProposalValidity,
  type SlateFloor,
} from './consolidate-validity-floor.ts';
export {
  type ArtifactConsolidateGate,
  type ArtifactConsolidateShipped,
  type ArtifactConsolidateSlice,
  type ArtifactConsolidation,
  type ArtifactConsolidationPolish,
  type ArtifactNaturalnessCorrection,
  type ArtifactNaturalnessFinding,
  type ArtifactNaturalnessReview,
  type ArtifactNaturalnessReviewRound,
  type ArtifactNaturalnessReviewSeat,
  describeConsolidateSlice,
} from './corpus-run/artifact-two-lane-consolidate.ts';
export { consolidateDocument, } from './consolidate-driver.ts';
export {
  type ConsolidationNaturalnessAudit,
  type ConsolidationNaturalnessCorrectionAudit,
  type ConsolidationPolish,
  type ConsolidationPolishConfig,
  polishConsolidation,
} from './consolidation-polish.ts';
export {
  CONSOLIDATION_POLISH_GATE_QUORUM,
  type ConsolidationPolishGateOutcome,
  gateConsolidationPolish,
  settleConsolidationPolishBallots,
} from './consolidation-polish-gate-stage.ts';
export {
  buildConsolidationPolishGateMessages,
  type ConsolidationPolishBallot,
  type ConsolidationPolishGateSubject,
  type ConsolidationPolishGateWire,
  isConsolidationPolishGateWire,
  type PolishChoice,
  readConsolidationPolishBallot,
} from './consolidation-polish-gate-wire.ts';
export { NaturalnessCompletenessError, } from './naturalness-completeness-error.ts';
export { NaturalnessRepairInterruptedError, } from './naturalness-repair-interrupted-error.ts';
export {
  consolidationWorthResuming,
  persistConsolidationSettlement,
} from './consolidate-persistence.ts';
export {
  contestStandingMayShip,
  standingTextFor,
} from './consolidate-standing.ts';
export {
  CONSOLIDATE_CACHE_VERSION,
  consolidateRunShape,
  consolidateSliceKey,
} from './consolidate-key.ts';
export {
  produceConsolidations,
  type ProducedConsolidations,
} from './consolidate-produce.ts';
export {
  type ConsolidationSettlement,
  type ConsolidationSubject,
  type ConsolidationTerminal,
  type ProposalVerdict,
  settleConsolidation,
} from './consolidate-settle.ts';
export {
  wrapConsolidation,
  wrapConsolidationProposals,
  type WrappedConsolidation,
} from './consolidate-wrap.ts';
export {
  buildConsolidateGateMessages,
  type ConsolidateGateSubject,
  type GateBallot,
  type GateChoice,
  type GateWire,
  isConsolidateGateWire,
  readConsolidateGateBallot,
} from './consolidate-gate-wire.ts';
export {
  buildConsolidateMessages,
  type ConsolidateSubject,
} from './consolidate-wire.ts';

//endregion Consolidation barrel
