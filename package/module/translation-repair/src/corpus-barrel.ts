//region Corpus run barrel
// Everything the corpus-pass driver and its benches expose: the settled
// artifact and its readers, the runs directory lock, the pipeline digest, and
// the bench draw.
//
// Split out of `pipeline-barrel.ts` when that file reached its line budget.
// The split is by AUDIENCE rather than alphabetically: these symbols exist for
// a run over the corpus, and none of them is reachable from the per-document
// pipeline.
//
// POOLING AND GENERATION IDENTITY LEFT for `generation-barrel.ts` on the same
// grounds when this file in turn reached the budget. `index.ts` composes both,
// so nothing importing the package sees the seam.

export { readAskedCount, } from './corpus-run/asked-count.ts';
export {
  TALLY_ERROR_CAP,
  tallyErrorText,
} from './corpus-run/tally-error-text.ts';
export {
  judgedAuthors,
  standingReportLines,
} from './corpus-run/editor-calibrate-standing.ts';
export {
  shippedAuthors,
  type SliceRounds,
  sliceProgressLine,
} from './corpus-run/editor-calibrate-slice.ts';
export * from './corpus-overlap-barrel.ts';
export { buildSettledArtifact, } from './corpus-run/artifact-build.ts';
export { buildSettledTwoLaneArtifact, } from './corpus-run/artifact-two-lane-build.ts';
export {
  collectTwoLaneShippedRegions,
  DAMAGE_LANES,
  type DamageLane,
  DamageRegionError,
  regionIdOf,
  regionsOfLane,
  type ShippedRegionCensus,
  type ShippedRegion,
} from './corpus-run/damage-region-v2.ts';
export {
  ARTIFACT_SCHEMA_VERSION_V2,
  ARTIFACT_SCHEMA_VERSION_V5,
  ARTIFACT_SCHEMA_VERSION_V6,
  ARTIFACT_SCHEMA_VERSION_V7,
  type ArtifactJsonValue,
  type ArtifactSectionAlignment,
  type ArtifactSectionCorrespondence,
  type SettledArtifact,
  type SettledLane,
  type SettledPreparation,
  isTwoLaneArtifactGeneration,
  TWO_LANE_GENERATIONS,
  type TwoLaneArtifactGeneration,
} from './corpus-run/artifact-two-lane-contract.ts';
export {
  type ArtifactContestSlice,
  type ArtifactContestVerdict,
  type ArtifactLaneSelection,
  contestEligibleIndexes,
  describeContestSlice,
} from './corpus-run/artifact-two-lane-contest.ts';
export {
  projectLanes,
  type ProjectedLanes,
} from './corpus-run/artifact-two-lane-derive.ts';
export { openConsolidateCache, } from './corpus-run/consolidate-cache-store.ts';
export { openLaneContestCache, } from './corpus-run/lane-contest-cache-store.ts';
export {
  ArtifactComparisonError,
  assertDerivationsAgree,
  compareLanes,
} from './corpus-run/artifact-two-lane-comparison.ts';
export {
  readRepairRounds,
  RoundsNotRecordedError,
} from './corpus-run/artifact-rounds-read.ts';
export {
  type DigestGroup,
  groupByDigest,
} from './corpus-run/digest-group.ts';
export {
  type DirectoryReading,
  filesystemReason,
  namesIn,
} from './corpus-run/directory-listing.ts';
export {
  OffRosterModelError,
  requireProducer,
  requireRosterModelId,
} from './corpus-run/artifact-producer-read.ts';
export { verifyArtifactAgainstPreparation, } from './corpus-run/artifact-two-lane-corpus-verify.ts';
export {
  comparisonRowDifferences,
  comparisonRowsEqual,
  decisionsEqual,
  deliveriesEqual,
  outcomesEqual,
} from './corpus-run/artifact-two-lane-row-equality.ts';
export {
  toArtifactComparisonRow,
  toArtifactDecisions,
  toArtifactDelivery,
  toArtifactOutcome,
  toArtifactRow,
} from './corpus-run/artifact-two-lane-project.ts';
export * from './corpus-entry-barrel.ts';
export * from './corpus-readiness-barrel.ts';
export { decidePassInsertionAdmission, } from './corpus-run/pass-insertion-admission.ts';
export { gatherEntryPictures, } from './corpus-run/entry-pictures.ts';
export {
  capOutlastsOneCall,
  capTooTightNote,
  HARD_CAP_VAR,
  HardCapOverrideError,
  resolveHardCapMinutes,
} from './corpus-run/cap-override.ts';
export { runAttemptQueue, } from './corpus-run/entry-attempt-queue.ts';
export {
  countCachedSlices,
  readAttemptOutcome,
  type ReattemptVerdict,
} from './corpus-run/entry-reattempt.ts';
export { openPictureReadingCache, } from './corpus-run/reading-cache-store.ts';
export {
  type CallReading,
  type CallTiming,
  readCallTiming,
  readRoundTiming,
  type RoundReading,
  type RoundTiming,
  STREAM_MARKER,
} from './corpus-run/run-timing-parse.ts';
export {
  type InFlight,
  measureInFlight,
  readRunTiming,
  type RunTiming,
} from './corpus-run/run-timing-read.ts';
export {
  belongsToNamespace,
  CONSOLIDATE_NAMESPACE,
  discardNamespace,
  EVERY_SLICE_NAMESPACE,
  PICTURE_READING_NAMESPACE,
  REPAIR_SLICE_NAMESPACE,
  type SliceNamespace,
  TRANSLATE_SLICE_NAMESPACE,
} from './corpus-run/slice-cache-namespace.ts';
export {
  type GatheredProbe,
  reportProbeTelemetry,
} from './corpus-run/probe-telemetry-report.ts';
export { settledTallyLine, } from './corpus-run/settled-tally.ts';
export {
  describeSpread,
  percentileOf,
  REPORTED_PERCENTILES,
} from './corpus-run/census-spread.ts';
export {
  censusEntry,
  type EntryCensus,
} from './corpus-run/slice-census-entry.ts';
export {
  ArtifactPreparationMismatchError,
  assertFindingsDescribePreparation,
  assertLedgerDescribesPreparation,
  assertResultCountsPreparation,
} from './corpus-run/artifact-two-lane-verify.ts';
export type {
  ArtifactComparisonRow,
  ArtifactDecisionComparison,
  ArtifactDeliveryRow,
  ArtifactLaneRelation,
  ArtifactSliceDelivery,
  ArtifactSliceOutcome,
} from './corpus-run/artifact-two-lane-vocabulary.ts';
export {
  isMarkupOnly,
  markupFraction,
} from './corpus-run/markup-slice.ts';
export { writeFileAtomic, } from './corpus-run/atomic-write.ts';
export { writeSheetPair, } from './corpus-run/sheet-write.ts';
export {
  parseRunJson,
  readRunJson,
  RunJsonUnreadableError,
} from './run-json-read.ts';
export { reportingRefusals, } from './corpus-run/cli-refusal.ts';
export { StatedRefusalError, } from './stated-refusal.ts';
export {
  DrawReconcileError,
  type DrawReconcileFault,
  reconcileSentence,
  type TypeofName,
} from './corpus-run/draw-reconcile.ts';
export {
  BenchDrawError,
  type DrawableSlice,
  orderBySourceSize,
  pickSpreadSample,
} from './corpus-run/bench-draw.ts';
export {
  type BenchCall,
  type CallTokens,
  recordingClient,
} from './corpus-run/bench-record.ts';
export {
  BenchReportError,
  benchWidths,
  summarizeBench,
  writeBenchReport,
} from './corpus-run/bench-report.ts';
export type { BenchRow, } from './corpus-run/roster-bench.ts';
export {
  type BenchSlice,
  sampleBenchSlices,
} from './corpus-run/bench-sample.ts';
export {
  classifyWidths,
  type HeadToHeadVerdict,
  readHeadToHead,
  summarizeWidths,
  type WidthArm,
  type WidthComparison,
  type WidthDraw,
  type WidthRow,
  type WidthSummary,
} from './corpus-run/editor-width-model.ts';
export {
  armInSeat,
  seatThatWon,
} from './corpus-run/editor-width-contest.ts';
export { writeWidthReport, } from './corpus-run/editor-width-report.ts';
export {
  evictStaleLock,
  lockRunsDir,
  releaseIfOwned,
  RunsDirectoryBusyError,
} from './corpus-run/runs-lock.ts';
export {
  assertPipelineDigest,
  digestPipeline,
  isDigestShaped,
  type PipelineDigest,
  PipelineDigestError,
  type PipelineStamp,
} from './corpus-run/pipeline-digest.ts';
export {
  collectEligiblePairs,
  type IncompleteEntry,
  type PassEligibility,
} from './corpus-run/pass-eligibility.ts';
export {
  persistProbeRun,
  type ProbeRun,
} from './corpus-run/probe-store.ts';
export {
  persistRecallScorecard,
  RECALL_SCORECARD_DIR,
  type RecallScorecardRecord,
} from './corpus-run/recall-scorecard-store.ts';
export {
  readRunnerClosure,
  type RunnerClosure,
} from './corpus-run/runner-closure.ts';

//endregion Corpus run barrel
export {
  appendTrialRow,
  completedArms,
  readTrialLedger,
  trialKey,
  type WindowTrialRow,
} from './corpus-run/window-trial-ledger.ts';
export {
  type ArmRate,
  type ClassReport,
  reportWindowTrial,
  type Transitions,
  TRIAL_ARMS,
} from './corpus-run/window-trial-report.ts';
export {
  CONTROL_CLASS,
  controlSlices,
  flaggedSlices,
  RELOCATION_CLASSES,
  type TrialSlice,
} from './corpus-run/window-trial-draw.ts';
export {
  armOrderFor,
  TRIAL_ARM_SET,
} from './corpus-run/window-trial-order.ts';
export {
  type PickOutcome,
  runPick,
} from './corpus-run/window-trial-pick.ts';
export { runSliceArms, } from './corpus-run/window-trial-slice.ts';
export {
  assertWindowReachedJudges,
  type SheetWitness,
  WINDOW_LABEL,
  WindowEvidenceError,
  witnessSheets,
} from './corpus-run/window-trial-witness.ts';
export {
  artifactBackedIds,
  countSettled,
} from './corpus-run/pass-settled.ts';
export {
  protocolDigest,
  type SliceYield,
  streakAfter,
} from './corpus-run/window-trial-protocol.ts';
