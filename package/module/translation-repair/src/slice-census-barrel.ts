//region Slice census barrel
// The slice census's lines, gathering and report, exported so each is tested
// where it is defined; the command that runs them is
// `corpus-run/slice-census.ts`. One entry's measure is in `corpus-barrel.ts`.

export { sliceCensusCarveLine, } from './corpus-run/slice-census-carve.ts';
export {
  gatherSliceCensus,
  type SliceCensusGathered,
  type SliceCensusRecipeReading,
} from './corpus-run/slice-census-gather.ts';
export { reportSliceCensus, } from './corpus-run/slice-census-report.ts';
export { sliceCensusTargetOnlyLines, } from './corpus-run/slice-census-target-only.ts';
export { sliceCensusTotal, } from './corpus-run/slice-census-total.ts';
export { sliceCensusUnpairedLines, } from './corpus-run/slice-census-unpaired.ts';
export { sliceCensusWidestLines, } from './corpus-run/slice-census-widest.ts';

//endregion Slice census barrel
