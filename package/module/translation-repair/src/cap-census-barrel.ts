//region Cap census barrel
// The completion cap rule's constants and the census that re-reads the rule
// over pass-run logs before a launch (ledger P10). Split from
// `provider-barrel.ts`, which sits at its line budget.

export {
  MIN_PROVIDER_CALLS,
  POOLED_P90,
} from './completion-cap.ts';
export {
  CAPS_ON_WIRE_AT,
  type CapLogReading,
  type CapSample,
  readCapLog,
} from './corpus-run/cap-census-read.ts';
export { capCensusPassRunReading, } from './corpus-run/cap-census-pass-run.ts';
export {
  type CapCensusTally,
  capCensusProviderLine,
  printCapCensus,
} from './corpus-run/cap-census-print.ts';
export { reportCapCensus, } from './corpus-run/cap-census-report.ts';
export {
  type CapCensus,
  capCensus,
  type CapCensusRow,
  type CapFlag,
  capFlagsOf,
  type ProviderCapReading,
} from './corpus-run/cap-census-rule.ts';

export { capCensusLogsUnder, } from './corpus-run/cap-census-walk.ts';

//endregion Cap census barrel
