//region Generation barrel
// Which artifacts may be pooled, and under which pipeline generation: the
// census, the eligibility filter, the two refusals it raises, artifact
// placement, and the guards that stop a resume writing across a generation
// boundary.
//
// Split out of `corpus-barrel.ts` when that file reached its line budget, at
// the seam that file names for its own split from `pipeline-barrel.ts`: by
// AUDIENCE. Everything here answers a question the measurement CLIs ask before
// they compute a rate, and the pass driver asks none of it.

export {
  censusByGeneration,
  type GenerationCensus,
  type GenerationGroup,
  resolveCommit,
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
  keepEligible,
  resolvePool,
} from './corpus-run/artifact-pool.ts';
export {
  EmptyPoolError,
  generationLines,
  MixedGenerationError,
  pluralEntries,
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
export { poolGeneration, } from './corpus-run/pool-generation.ts';

//endregion Generation barrel
