//region Coverage census barrel
// The parts of the coverage census (ledger T8), exported so each is tested
// where it is defined; the entry that runs the suite is
// `corpus-run/coverage-census.ts`.

export {
  nodeEntries,
  runnerEntrySources,
} from './build-entries.ts';
export {
  CENSUS_FORMAT,
  CensusBaselineError,
  type CensusArguments,
  FAIL_MARKER,
  markerCount,
  PASS_MARKER,
  readBaselineStretches,
  readCensusArguments,
} from './corpus-run/coverage-census-input.ts';
export {
  baselineReportLines,
  censusReportLines,
  type CensusSummary,
  type UnloadedSource,
} from './corpus-run/coverage-census-print.ts';
export {
  baselineStatusesOf,
  type CensusStretch,
  censusStretchesOf,
  type KindTotal,
  kindTotalsOf,
  requirePlacedFunctions,
  type SourceKind,
  sourceKindOf,
  type SourceRow,
  sourceRowsOf,
  type StretchStatus,
} from './corpus-run/coverage-census-report.ts';
export {
  coverageReadings,
  packageCommit,
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

//endregion Coverage census barrel
