//region Sampler barrel
// The procedures moved out of the entry files of the model, roster and sample
// commands (`model-health`, `model-catalog`, `roster-card`, `draw-sample`,
// `damage-sample`, `budget-sample`), so each has a unit test through the built
// package. Kept apart from the roster and sheet barrels for their line budget.

export { askModelHealth, } from './corpus-run/model-health-probe.ts';
export { reportModelHealth, } from './corpus-run/model-health-report.ts';
export { printModelCatalog, } from './corpus-run/model-catalog-print.ts';
export {
  LISTING_TIMEOUT_MS,
  readProviderListing,
} from './corpus-run/provider-listing.ts';
export {
  fetchListing,
  LISTING_URL,
} from './corpus-run/roster-card-listing.ts';
export { printRosterCard, } from './corpus-run/roster-card-print.ts';
export {
  type ProviderKeys,
  readProviderKeys,
} from './corpus-run/budget-sample-keys.ts';
export { sampleBudgets, } from './corpus-run/budget-sample-run.ts';
export { listSettledNames, } from './corpus-run/sample-artifact-names.ts';
export {
  type DrawPool,
  readDrawPool,
} from './corpus-run/draw-sample-pool.ts';
export { poolBandLines, } from './corpus-run/draw-sample-bands.ts';
export {
  type DrawPaths,
  writeDrawSheets,
} from './corpus-run/draw-sample-sheets.ts';
export { drawGradingSample, } from './corpus-run/draw-sample-run.ts';
export { collectShippedRegions, } from './corpus-run/damage-sample-pool.ts';
export {
  buildCase,
  drawRegions,
} from './corpus-run/damage-sample-draw.ts';
export {
  emptyPoolSays,
  poolLines,
  wroteLine,
} from './corpus-run/damage-sample-lines.ts';
export { sampleDamage, } from './corpus-run/damage-sample-run.ts';

//endregion Sampler barrel
