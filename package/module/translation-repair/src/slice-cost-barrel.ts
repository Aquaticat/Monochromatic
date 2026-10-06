//region Slice cost barrel
// The slice cost report's bands, spread, lanes and run, exported so each is
// tested where it is defined; the command that runs them is
// `corpus-run/slice-cost-report.ts`. The writer and the reader of the cost
// lines are in `document-barrel.ts`.

export {
  bucketSliceCostsBySize,
  type CostBucket,
  printSliceCostBucket,
} from './corpus-run/slice-cost-bands.ts';
export { printSliceCostLanes, } from './corpus-run/slice-cost-lanes.ts';
export { reportSliceCost, } from './corpus-run/slice-cost-report-run.ts';
export { printSliceCostSpread, } from './corpus-run/slice-cost-spread.ts';

//endregion Slice cost barrel
