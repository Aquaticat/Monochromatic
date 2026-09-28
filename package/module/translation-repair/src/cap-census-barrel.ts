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
  type CapSample,
  capSamplesOf,
} from './corpus-run/cap-census-read.ts';
export {
  type CapCensus,
  capCensus,
  type CapCensusRow,
  type CapFlag,
  capFlagsOf,
  type ProviderCapReading,
} from './corpus-run/cap-census-rule.ts';

//endregion Cap census barrel
