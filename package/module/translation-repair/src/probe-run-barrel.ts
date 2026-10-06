//region Probe run barrel
// The walks and printers of the sentinel, displacement, coverage-control,
// coverage and translate probes, moved out of their entry files so their
// tests can import them like every sibling's. Each entry file keeps only its
// wiring.

export {
  probeCorpusEntries,
} from './corpus-run/sentinel-probe-run.ts';
export {
  probeErrorLine,
  type ProbedResult,
  probeResultLine,
} from './corpus-run/sentinel-probe-line.ts';
export { reportLines, } from './corpus-run/displacement-probe-report.ts';
export {
  type EntryDisplacement,
  readEntry,
} from './corpus-run/displacement-probe-row.ts';
export { probeDisplacement, } from './corpus-run/displacement-probe-run.ts';
export {
  type CorpusTotals,
  corpusTotals,
  isNotable,
} from './corpus-run/displacement-probe-totals.ts';
export { gatherCases, } from './corpus-run/coverage-control-probe-cases.ts';
export {
  controlLines,
  offeringLine,
} from './corpus-run/coverage-control-probe-lines.ts';
export { runCoverageControl, } from './corpus-run/coverage-control-probe-run.ts';
export {
  type PairRead,
  readPair,
} from './corpus-run/coverage-probe-pair.ts';
export {
  answeredRow,
  failedRow,
  type ProbeRow,
  whereOf,
} from './corpus-run/coverage-probe-row.ts';
export { runCoverageProbe, } from './corpus-run/coverage-probe-run.ts';
export {
  coverageOf,
  sparsestPair,
} from './corpus-run/translate-probe-coverage.ts';
export {
  heardLines,
  PROBE_SLICES,
  sectionLine,
  sliceHeading,
  slicesLine,
} from './corpus-run/translate-probe-lines.ts';
export { probeTranslate, } from './corpus-run/translate-probe-run.ts';

//endregion Probe run barrel
