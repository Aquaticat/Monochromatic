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
  computeRepairScorecard,
  contentWords,
  measureSeedRestoration,
  MIN_REPAIR_DISPATCH_BUDGET_MS,
  type RepairAttemptRecord,
  type RepairBenchmarkResult,
  type RepairScorecard,
  RESTORATION_WORD_THRESHOLD,
  runRepairBenchmark,
  type SeedRestoration,
} from './repair-benchmark.ts';
export {
  type ChunkRepairOutcome,
  repairChunk,
  type RepairModels,
} from './repair-chunk.ts';
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
  NON_TRANSLATION_BLOCK_VOTES,
  type RepairIssueRecord,
  type RepairStatus,
  repairTranslation,
  type RepairTranslationResult,
} from './repair-translation.ts';
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
