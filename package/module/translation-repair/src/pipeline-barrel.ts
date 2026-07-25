//region Pipeline barrel
// Repair-phase surface: claim aggregation, adjudication, envelopes and the
// patch gate, editor and checker stages, candidate selection, the
// end-to-end driver, and the milestone-two benchmark. Split from the root
// barrel so each stays under the file-size budget.

export {
  type AdjudicatedIssue,
  type AdjudicationConfig,
  type AdjudicationStatus,
  type BallotVerdict,
  DEFAULT_ADJUDICATION_CONFIG,
  isPanelVoteState,
  PANEL_VOTE_STATES,
  type PanelBallot,
  type PanelVoteState,
  type VoteTally,
} from './adjudicate-model.ts';
export {
  type AdjudicationPromptPlan,
  buildAdjudicationMessages,
} from './adjudicate-prompt.ts';
export {
  ADJUDICATION_RESPONSE_FORMAT,
  isPanelBallotWire,
  type PanelBallotWire,
  type PanelGroupWire,
  type PanelVerdictWire,
  resolvePanelBallot,
} from './adjudicate-wire.ts';
export {
  type AggregatedClaim,
  aggregateClaims,
  type ClaimAggregation,
  type ClaimCluster,
  CLUSTER_ANCHOR_TOLERANCE,
} from './aggregate-claims.ts';
export {
  applyPatchOperations,
  EnvelopeOverlapError,
  type PatchOperation,
  type PatchOutcome,
  type PatchRejection,
} from './apply-patch.ts';
export {
  runDerivabilityProbe,
  type SeedDerivability,
} from './derivability-probe.ts';
export {
  buildDerivabilityMessages,
  DERIVABILITY_RESPONSE_FORMAT,
  DERIVABILITY_VERDICTS,
  type DerivabilityPlan,
  type DerivabilityVerdict,
  isDerivabilityVerdict,
  resolveDerivabilityJudgment,
} from './derivability-wire.ts';
export {
  buildEditorMessages,
  type EditorPromptPlan,
} from './edit-prompt.ts';
export {
  EDITOR_RESPONSE_FORMAT,
  type EditorEditResolution,
  type EditorEditWire,
  type EditorReportWire,
  isEditorReportWire,
  resolveEditorEdits,
} from './edit-wire.ts';
export {
  deriveEditableEnvelopes,
  type EditableEnvelope,
  type EnvelopePlan,
} from './patch-model.ts';
export {
  contentWords,
  measureSeedRestoration,
  RESTORATION_WORD_THRESHOLD,
  type SeedRestoration,
} from './lexical-restoration.ts';
export {
  computeRepairScorecard,
  DEFAULT_JUDGE_MODEL_IDS,
  MIN_REPAIR_DISPATCH_BUDGET_MS,
  type RepairAttemptRecord,
  type RepairBenchmarkResult,
  type RepairScorecard,
  runRepairBenchmark,
} from './repair-benchmark.ts';
export { repairChunk, } from './repair-chunk.ts';
export {
  type ChunkRepairOutcome,
  type RepairModels,
} from './repair-contract.ts';
export {
  type CheckerStageResult,
  type EditorStageResult,
  runCheckerStage,
  runEditorStage,
} from './repair-edit-stages.ts';
export {
  type CriticStageResult,
  type PanelStageResult,
  runCriticStage,
  runPanelStage,
} from './repair-stages.ts';
export {
  assessNonTranslationDominance,
  assessNonTranslationEvidence,
  NON_TRANSLATION_BLOCK_VOTES,
  NON_TRANSLATION_CONTRADICTION_MIN,
  type NonTranslationDominance,
  type NonTranslationEvidence,
  type NonTranslationScreening,
  nonTranslationVotesStand,
  screenNonTranslationVotes,
  sliceAnchorsTranslation,
} from './non-translation-evidence.ts';
export {
  ArtifactParseError,
  type ParsedArtifact,
  parseSettledArtifact,
} from './artifact-read.ts';
export { formatGradingSheet, } from './grading-sheet.ts';
export {
  allocateBandQuota,
  drawStratifiedSample,
} from './sample-draw.ts';
export {
  type BandQuota,
  classifyBand,
  DEFAULT_PRECISION_BAR,
  DEFAULT_SAMPLE_SEED,
  DEFAULT_SAMPLE_SIZE,
  extractGradingCandidate,
  type GradableClaim,
  type GradableIssue,
  type GradableSpan,
  type GradingCandidate,
  MEDIUM_BAND_MAX_BYTES,
  SIZE_BANDS,
  type SizeBand,
  SMALL_BAND_MAX_BYTES,
} from './sample-grading.ts';
export {
  SLICE_CHAR_BUDGET,
  subdivideChunkPair,
} from './slice-pair.ts';
export {
  type RepairIssueRecord,
  type RepairStatus,
  repairTranslation,
  type RepairTranslationResult,
  type SliceCache,
} from './repair-translation.ts';
export {
  buildRestorationJudgeMessages,
  isRestorationJudgeWire,
  isRestorationVerdict,
  type JudgeReference,
  RESTORATION_JUDGE_RESPONSE_FORMAT,
  RESTORATION_JUDGE_VERDICTS,
  type RestorationJudgePlan,
  type RestorationJudgeWire,
  type RestorationJudgmentWire,
  type RestorationVerdict,
  resolveRestorationJudgment,
} from './restoration-judge-wire.ts';
export {
  runRestorationJudge,
  type SeedJudgment,
} from './restoration-judge.ts';
export { gradeSeedDetection, } from './seed-detection.ts';
export {
  attemptStageCall,
  type StageVoice,
} from './stage-call.ts';
export {
  gatherStageVoices,
  type HeardVoice,
  STAGE_RETRY_ROUNDS,
  type StageGather,
} from './stage-quorum.ts';
export {
  buildResolutionMessages,
  isResolutionReportWire,
  isResolutionVerdict,
  RESOLUTION_RESPONSE_FORMAT,
  RESOLUTION_VERDICTS,
  type ResolutionCheckWire,
  type ResolutionPromptPlan,
  type ResolutionReportWire,
  type ResolutionVerdict,
} from './resolution-wire.ts';
export {
  type CandidateMeasurements,
  type CandidateSelection,
  compareCandidates,
  type RepairCandidate,
  selectRepairCandidate,
  UNCHANGED_CANDIDATE_ID,
  UNCHANGED_MEASUREMENTS,
} from './select-candidate.ts';
export {
  type IssueResolutionTally,
  resolveResolutionChecks,
  type ResolutionBallot,
  tallyResolutionChecks,
} from './tally-resolution.ts';
export {
  type AdjudicationResult,
  tallyVotes,
} from './tally-votes.ts';

//endregion Pipeline barrel
