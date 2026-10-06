//region Coverage census barrel
// The parts of the coverage census (ledger T8), exported so each is tested
// where it is defined; the entry that runs the suite is
// `corpus-run/coverage-census.ts`.

export {
  nodeEntries,
  runnerEntrySources,
} from './build-entries.ts';
export {
  type BundleMaps,
  bundleMapsOf,
  type MapNeed,
  requireMapFor,
  requireUnminifiedBuild,
} from './corpus-run/coverage-bundle-maps.ts';
export {
  type PlacedTally,
  placeTally,
  readMappedBundles,
} from './corpus-run/coverage-census-place.ts';
export {
  invariantThrowCountLine,
  invariantThrowListLines,
  type InvariantThrowRow,
  invariantThrowRowsOf,
  type InvariantThrowStretch,
} from './corpus-run/coverage-census-invariant.ts';
export {
  type StretchReading,
  stretchReadingOf,
} from './corpus-run/coverage-invariant-throw.ts';
export {
  type Atom,
  atomAt,
} from './corpus-run/coverage-stretch-atoms.ts';
export {
  CENSUS_FORMAT,
  CensusBaselineError,
  type CensusArguments,
  censusFileText,
  FAIL_MARKER,
  markerCount,
  PASS_MARKER,
  readBaselineCensus,
  readBaselineFile,
  readCensusArguments,
} from './corpus-run/coverage-census-input.ts';
export {
  baselineReportLines,
  censusReportLines,
  type CensusSummary,
  type UnloadedSource,
} from './corpus-run/coverage-census-print.ts';
export {
  type BaselineCensus,
  baselineStatusesOf,
  type ColdSince,
  coldSinceOf,
  type EditedClaim,
  editedClaimsOf,
  type EmptyClaim,
  emptyClaimsOf,
  type StretchStatus,
} from './corpus-run/coverage-census-baseline.ts';
export {
  packageCommit,
  sourcesEditedSince,
} from './corpus-run/coverage-census-commit.ts';
export {
  type CensusStretch,
  censusStretchesOf,
  isUnmappedSource,
  type KindTotal,
  kindTotalsOf,
  requirePlacedFunctions,
  type SourceKind,
  sourceKindOf,
  type SourceRow,
  sourceRowsOf,
  unmappedSourceOf,
} from './corpus-run/coverage-census-report.ts';
export {
  coverageReadings,
  readBundle,
  runSuite,
  tallyCoverage,
  unloadedSourcesOf,
} from './corpus-run/coverage-census-steps.ts';
export {
  type BundleScript,
  bundleScriptsOf,
  CoverageFileError,
  type CoverageRange,
  type FunctionCoverage,
} from './corpus-run/coverage-file.ts';
export { lineStartsOf, } from './line-starts.ts';
export {
  type BundleLines,
  bundleLinesOf,
  type MappedFunction,
  mapFunction,
  readSourceMap,
  type SourceEntry,
  SourceMapFileError,
  type SourceLine,
  sourceLineAt,
} from './corpus-run/coverage-lines.ts';
export {
  type MappedStretch,
  mapStretch,
  type SourceSpan,
  type StretchPiece,
} from './corpus-run/coverage-pieces.ts';
export {
  type ColdStretch,
  type CoverageTally,
  CoverageTallyError,
  createCoverageTally,
  type FunctionSite,
  type UncalledFunction,
} from './corpus-run/coverage-tally.ts';
export {
  type Baseline,
  baselineReadingsOf,
} from './corpus-run/coverage-census-baseline-lines.ts';
export { requireCoverageBuild, } from './corpus-run/coverage-census-build.ts';
export { reportCensus, } from './corpus-run/coverage-census-reading.ts';
export {
  type CoverageCensusSteps,
  readBaselines,
  runCoverageCensus,
} from './corpus-run/coverage-census-run.ts';
export {
  type ReadText,
  readUtf8Text,
} from './corpus-run/coverage-census-read-text.ts';

//endregion Coverage census barrel
