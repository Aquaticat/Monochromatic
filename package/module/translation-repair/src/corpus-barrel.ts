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
  assertResumableGeneration,
  GenerationDriftError,
  LegacyPipelineError,
  readDriftOptIn,
  UnplaceableArtifactError,
} from './corpus-run/pass-generation-guard.ts';
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
