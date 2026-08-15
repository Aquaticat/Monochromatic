//region Pipeline barrel
// Repair-phase surface: claim aggregation, adjudication, envelopes and the
// patch gate, editor and checker stages, candidate selection, and the
// end-to-end driver. What a run PRODUCES lives here; what measures a finished
// run afterwards lives in the sheet and recall barrels. Split from the root
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
  type ChunkCriticPhase,
  runChunkCriticPhase,
} from './chunk-critic-phase.ts';
export { repairChunk, } from './repair-chunk.ts';
export {
  assertCheckerIndependence,
  assertJudgeableEditorRoster,
  assertJudgeableProducerRoster,
  CheckerIndependenceError,
  type ChunkRepairOutcome,
  EditorRosterError,
  type RepairModels,
} from './repair-contract.ts';
export {
  type CheckerStageResult,
  runCheckerStage,
} from './repair-edit-stages.ts';
export {
  type EditorStageResult,
  runEditorStage,
} from './repair-editor-stage.ts';
export {
  type Candidate,
  type CandidateProducer,
  describeProducer,
  FULL_VOTE_WEIGHT,
  mergeProducers,
  MIN_SELECTION_WEIGHT,
  producerModelIds,
  type SelectionBallot,
  type SelectionDisposition,
  type SelectionOutcome,
  type SelectionTally,
  SELF_VOTE_WEIGHT,
} from './candidate-select-model.ts';
export { mergeIdenticalCandidates, } from './candidate-merge.ts';
export { collectEnvelopeProposals, } from './editor-proposals.ts';
export { selectBestCandidate, } from './candidate-select.ts';
export {
  buildCandidateSelectMessages,
  CANDIDATE_NONE,
  CANDIDATE_SELECT_RESPONSE_FORMAT,
  type CandidateBallotWire,
  isCandidateBallotWire,
  type SelectEvidence,
} from './candidate-select-wire.ts';
export {
  applyCandidate,
  type EditorCandidate,
  type EnvelopeSelection,
  selectChunkPatch,
  selectPerEnvelope,
} from './editor-ensemble.ts';
export {
  buildChunkCandidates,
  buildEditorCandidates,
  type ChunkCandidateSet,
  type EditorCandidateSet,
  pickFallbackPatch,
} from './editor-candidates.ts';
export {
  buildGrid,
  type Grid as HeadingAlignGrid,
} from './align-headings-grid.ts';
export {
  alignHeadingsForced,
  type ForcedAlignStep,
  type UnpairedReason,
} from './align-headings-forced.ts';
export {
  dedupeAcceptedIssues,
  type DedupeOutcome,
} from './dedupe-issues.ts';
export { buildEditorAddendum, } from './line-structure-addendum.ts';
export {
  type ChunkGovernance,
  type ChunkSlice,
  governedSliceIndices,
} from './line-structure-inherit.ts';
export {
  type PreparedDocumentPair,
  prepareDocumentPair,
} from './document-preparation.ts';
export {
  type DocumentLanesResult,
  runDocumentLanes,
} from './document-lanes.ts';
export {
  AssemblyContractError,
  assertDocumentChangeAgrees,
  assertReplacementsChange,
  type OrderedChangeSets,
  orderedChangeSets,
} from './assembly-invariant.ts';
export {
  compareDocumentLanes,
  LaneComparisonError,
  type SliceLaneComparison,
  type SliceLaneVerdict,
} from './lane-comparison.ts';
export {
  buildLaneSliceTexts,
  LaneSliceCoverageError,
  type LaneSliceText,
} from './lane-slice-text.ts';
export {
  resumedSliceAgrees,
  resumedSliceDiscardFinding,
  type ResumedSliceLane,
} from './resumed-slice.ts';
export {
  repairRunShape,
  repairSliceKey,
  SLICE_CACHE_VERSION,
} from './repair-slice-key.ts';
export { footnoteIdentifiers, } from './footnote-mentions.ts';
export {
  guardFootnoteAssembly,
  type GuardedAssembly,
  introducedFootnoteFindings,
  introducedStructuralRegressions,
} from './assembly-integrity.ts';
export { isLineStructured, } from './line-structure.ts';
export {
  checkPreservation,
  type PreservationVerdict,
} from './preservation-check.ts';
export {
  contentTokens,
  properNouns,
} from './preservation-tokens.ts';
export {
  buildChunkCriticRecords,
  type ChunkCriticRecord,
  type ClaimAttribution,
  type ClaimEmission,
  type ClaimProposer,
  collectClaimAttributions,
  retainAttributions,
} from './critic-attribution.ts';
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
  scorePairing,
  tokenize,
} from './align-blocks.ts';
export {
  alignBlocks,
  type AlignmentStep,
} from './align-blocks-walk.ts';
export {
  type AlignedRun,
  groupNodesAligned,
} from './group-aligned.ts';
export {
  fenceForMarkdown,
  longestBacktickRun,
} from './markdown-fence.ts';
export {
  collectIdentityLines,
  type DeclaredIdentity,
  extractDeclaredIdentity,
} from './identity-context.ts';
export {
  SLICE_CHAR_BUDGET,
  subdivideChunkPair,
} from './slice-pair.ts';
export {
  repairPreparedDocument,
  type RepairStatus,
  repairTranslation,
  type RepairTranslationResult,
} from './repair-translation.ts';
export type { SliceCache, } from './slice-cache.ts';
export {
  buildIssueRecords,
  type RepairDisposition,
  type IssueProbeReading,
  type RepairIssueRecord,
} from './repair-record.ts';
export {
  collectRepairRegions,
  type RepairRegion,
} from './repair-region.ts';
export {
  measurePatchedCandidate,
  selectCreditableIssues,
} from './chunk-measure.ts';
export { downgradeCount, } from './downgrade-count.ts';
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
