//region Corpus run barrel
// Everything the corpus-pass driver and its benches expose: artifact pooling
// and provenance, the runs directory lock, the pipeline digest, and the bench
// draw.
//
// Split out of `pipeline-barrel.ts` when that file reached its line budget.
// The split is by AUDIENCE rather than alphabetically: these symbols exist for
// a run over the corpus, and none of them is reachable from the per-document
// pipeline.

export { buildSettledArtifact, } from './corpus-run/artifact-build.ts';
export { buildSettledArtifactV2, } from './corpus-run/artifact-v2-build.ts';
export {
  ARTIFACT_SCHEMA_VERSION_V2,
  type ArtifactJsonValue,
  type SettledArtifactV2,
  type SettledLaneV2,
  type SettledPreparationV2,
} from './corpus-run/artifact-v2-contract.ts';
export {
  ArtifactComparisonV2Error,
  assertDerivationsAgree,
  compareLanesV2,
} from './corpus-run/artifact-v2-comparison.ts';
export {
  type AudienceSplit,
  rateByVoice,
  type AuditRelocationPair,
  splitFor,
  type VoiceRate,
} from './corpus-run/rendering-audit-settled-read.ts';
export { auditRelocationPairs, } from './corpus-run/rendering-audit-settled-relocation.ts';
export {
  type AuditRepeatPair,
  auditRepeatsAcross,
  type AuditRepeatSide,
  auditRepeatsWithin,
} from './corpus-run/rendering-audit-settled-repeat.ts';
export {
  type AuditRepeatBand,
  bandOf,
} from './corpus-run/rendering-audit-settled-band.ts';
export {
  digestAuditedText,
  sameAuditedText,
  textIdentityOf,
} from './corpus-run/rendering-audit-settled-digest.ts';
export type {
  AuditedTextIdentity,
  SettledAuditRow,
} from './corpus-run/rendering-audit-settled-row.ts';
export {
  readArchiveSubjects,
  readArtifactSubjects,
  type SettledArtifactReading,
  type SettledAuditSubject,
  type SettledIdentity,
  type SettledVerification,
} from './corpus-run/rendering-audit-settled-input.ts';
export { parseSettledArtifactV2, } from './corpus-run/artifact-v2-read.ts';
export { verifyArtifactV2AgainstPreparation, } from './corpus-run/artifact-v2-corpus-verify.ts';
export { parseLanesV2, } from './corpus-run/artifact-v2-read-lanes.ts';
export {
  parseRepairEvidenceV2,
  parseTranslateEvidenceV2,
} from './corpus-run/artifact-v2-read-evidence.ts';
export {
  assertEvidenceMatchesLedger,
  assertRowsCoherent,
} from './corpus-run/artifact-v2-read-row-relations.ts';
export {
  assertBlockedCompatible,
  assertIndexSetsMatchLedger,
  assertTranslateCountsAgree,
} from './corpus-run/artifact-v2-read-set-relations.ts';
export { assertRecordedComparisonMatches, } from './corpus-run/artifact-v2-read-comparison.ts';
export {
  parseDecisionComparisonV2,
  parseSliceDeliveryV2,
  parseSliceOutcomeV2,
  type UnknownKeyPolicy,
} from './corpus-run/artifact-v2-read-vocabulary.ts';
export {
  parseComparisonRowV2,
  parseDeliveryRowV2,
  parseEvidenceRowV2,
} from './corpus-run/artifact-v2-read-rows.ts';
export type {
  ArtifactEvidenceRowV2,
  ArtifactRepairEvidenceV2,
  ArtifactRepairStatusV2,
  ArtifactTranslateEvidenceV2,
  ArtifactTranslateStatusV2,
  ParsedArtifactV2,
  ParsedLaneV2,
  ParsedPreparationV2,
} from './corpus-run/artifact-v2-read-contract.ts';
export {
  comparisonRowsEqualV2,
  decisionsEqualV2,
  deliveriesEqualV2,
  outcomesEqualV2,
} from './corpus-run/artifact-v2-row-equality.ts';
export {
  toArtifactComparisonRowV2,
  toArtifactDecisionsV2,
  toArtifactDeliveryV2,
  toArtifactOutcomeV2,
  toArtifactRowV2,
} from './corpus-run/artifact-v2-project.ts';
export {
  type CorpusPair,
  settleEntry,
} from './corpus-run/pass-entry.ts';
export { settledTallyLine, } from './corpus-run/settled-tally.ts';
export {
  ArtifactPreparationMismatchError,
  assertFindingsDescribePreparation,
  assertLedgerDescribesPreparation,
  assertResultCountsPreparation,
} from './corpus-run/artifact-v2-verify.ts';
export type {
  ArtifactComparisonRowV2,
  ArtifactDecisionComparisonV2,
  ArtifactDeliveryRowV2,
  ArtifactLaneVerdictV2,
  ArtifactSliceDeliveryV2,
  ArtifactSliceOutcomeV2,
} from './corpus-run/artifact-v2-vocabulary.ts';
export {
  censusByGeneration,
  type GenerationCensus,
  type GenerationGroup,
  tipContains,
} from './corpus-run/artifact-generation.ts';
export {
  type Placement,
  readdirArtifacts,
  readPlacement,
} from './corpus-run/artifact-placement.ts';
export {
  type EligibleEntries,
  selectEligible,
} from './corpus-run/artifact-eligible.ts';
export {
  EmptyPoolError,
  MixedGenerationError,
} from './corpus-run/artifact-pool-refusal.ts';
export {
  assertArtifactsPlaceable,
  assertBuildGenerationResumable,
  assertResumableGeneration,
  GenerationDriftError,
  LegacyPipelineError,
  readDriftOptIn,
  UnplaceableArtifactError,
} from './corpus-run/pass-generation-guard.ts';
export {
  assertResumableSchemaGeneration,
  MislabelledArtifactError,
  SchemaGenerationError,
} from './corpus-run/pass-schema-guard.ts';
export {
  censusBySchema,
  type SchemaCensusRow,
  type SchemaClassification,
} from './corpus-run/pass-schema-census.ts';
export {
  abbreviate,
  ArtifactProvenanceError,
  assertArtifactProvenance,
  type GenerationSelection,
} from './corpus-run/artifact-provenance.ts';
export { writeFileAtomic, } from './corpus-run/atomic-write.ts';
export {
  type DrawableSlice,
  orderBySourceSize,
  pickSpreadSample,
} from './corpus-run/bench-draw.ts';
export {
  type BenchCall,
  type CallTokens,
  recordingClient,
} from './corpus-run/bench-record.ts';
export { benchWidths, } from './corpus-run/bench-report.ts';
export {
  lockRunsDir,
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
  persistProbeRun,
  type ProbeRun,
} from './corpus-run/probe-store.ts';

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
