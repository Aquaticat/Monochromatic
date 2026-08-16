//region Sheet barrel
// Grading-sheet surface: reading a settled run's artifacts, drawing a
// stratified sample from them, rendering the sheets a human grades, and reading
// the verdicts back as precision and agreement. Everything here runs after a
// pass rather than inside one. Split from the pipeline barrel so each stays
// under the file-size budget.

export {
  ArtifactParseError,
  requireArray,
  requireBoolean,
  requireCount,
  requireRecord,
  requireString,
} from './artifact-guard.ts';
export {
  requireArtifactJsonValue,
  requireExactKeys,
  requireOpenRecord,
} from './artifact-exact-guard.ts';
export {
  GradedSheetExistsError,
  resolveSheetPath,
  type SheetKind,
  UnsafeSeedError,
} from './corpus-run/sheet-path.ts';
export {
  parseRecordRepair,
  type RecordRepairReading,
} from './artifact-repair-read.ts';
export {
  type ArtifactChangeSets,
  readArtifactChangeSets,
} from './artifact-change-sets.ts';
export {
  type ArtifactSchemaReading,
  KNOWN_ARTIFACT_SCHEMA_VERSIONS,
  readArtifactSchemaVersion,
  SETTLED_ARTIFACT_SCHEMA_VERSION,
} from './artifact-schema-version.ts';
export {
  type ParsedAcceptedIssue,
  type ParsedArtifact,
  parseSettledArtifact,
} from './artifact-read.ts';
export { formatGradingSheet, } from './grading-sheet.ts';
export {
  type GradedItem,
  type GradeVerdict,
  parseGradedSheet,
} from './grade-sheet-read.ts';
export {
  type GradedRepairItem,
  parseGradedRepairSheet,
  readSheetIdentity,
  type SheetIdentity,
  type RepairVerdict,
} from './repair-grade-read.ts';
export {
  opensWithVerdict,
  trimLeadingDelimiters,
  VERDICT_DELIMITERS,
} from './verdict-letter.ts';
export {
  type AgreementTally,
  parsePreGrades,
  type PrecisionTally,
  scoreGradeAgreement,
  scoreGradedPrecision,
} from './grade-agreement.ts';
export { formatRepairSheet, } from './repair-sheet.ts';
export {
  type AttemptMap,
  readAttemptMap,
} from './corpus-run/attempt-store.ts';
export {
  createRunClient,
  readHeadSha,
  resolveRunsDir,
} from './corpus-run/run-config.ts';
export {
  type AttributionGather,
  gatherAttributionEntries,
  type MalformedArtifact,
} from './corpus-run/attribution-read.ts';
export {
  type AcceptedIssueView,
  type AttributionEntry,
  type AttributionReport,
  buildAttributionReport,
  type ChunkCriticView,
  type CriticTally,
  type ProposerView,
} from './corpus-run/attribution-report.ts';
export {
  buildCrosscheckCensus,
  type CrosscheckArm,
  type CrosscheckCensus,
  type CrosscheckItem,
} from './corpus-run/judge-crosscheck.ts';
export { readOnlyIds, } from './corpus-run/entry-filter.ts';
export {
  type JudgeSeating,
  MIN_JUDGED_CLAIMS,
  renderJudgedRate,
  seatJudges,
} from './corpus-run/judge-independence.ts';
export {
  CATALOG_MODEL_IDS,
  type CatalogComparison,
  compareCatalog,
  decodeModelList,
  formatCatalogReport,
  type ServedModel,
} from './corpus-run/model-catalog-compare.ts';
export {
  discardSliceCache,
  listResumableEntries,
  openSliceCache,
  openTranslateSliceCache,
} from './corpus-run/slice-cache-store.ts';
export { indexReadingsByIssue, } from './probe-issue-index.ts';
export {
  type DrawOutputs,
  trackDrawOutputs,
} from './corpus-run/draw-outputs.ts';
export {
  bandOf,
  countSettledPerBand,
  MEDIUM_PAGE_BYTES,
  rankWithinBands,
  type SizedEntry,
  smallBandIds,
  SMALL_PAGE_BYTES,
} from './corpus-run/band-order.ts';
export {
  allocateBandQuota,
  drawStratifiedSample,
} from './sample-draw.ts';
export {
  buildSampleManifest,
  parseSampleManifest,
  type SampleManifest,
  type SampleManifestItem,
} from './sample-manifest.ts';
export {
  computeDrawDigest,
  DRAW_IDENTITY_DOMAIN,
  type DrawIdentityItem,
} from './sample-draw-identity.ts';
export {
  assertSheetMatchesManifest,
  HEADER_ONLY_BINDING_NOTE,
  requireSheetSeed,
  type SheetBindingStrength,
} from './sheet-binding.ts';
export {
  assertRepairMeasurable,
  assertSourceBytes,
  type BandQuota,
  classifyBand,
  classifySourceAnchor,
  type SourceBytes,
  sourceBytesOf,
  type SourceAnchorKind,
  countUnrecordedRepairs,
  UnmeasurableRepairError,
  DEFAULT_PRECISION_BAR,
  DEFAULT_SAMPLE_SEED,
  DEFAULT_SAMPLE_SIZE,
  extractGradingCandidate,
  type GradableClaim,
  type GradableIssue,
  type GradableRepair,
  type GradableRepairRegion,
  type GradableSpan,
  type GradingCandidate,
  MEDIUM_BAND_MAX_BYTES,
  SIZE_BANDS,
  type SizeBand,
  SMALL_BAND_MAX_BYTES,
} from './sample-grading.ts';

//endregion Sheet barrel
