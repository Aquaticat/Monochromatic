//region Displacement barrel
// The size instrument: what each slice's ratio is, which slices are implausible
// enough that they may not say what normal is, what a document's own expansion
// therefore comes to, and which slice pairs look like a passage that moved.
//
// SPLIT OUT OF THE TRANSLATE BARREL when `#163` added the implausibility
// predicate and pushed that file one line over the budget. Grouping by what the
// exports MEASURE rather than by which lane happens to read them also puts the
// estimator beside the predicate that filters its input, which is the pair a
// reader has to see together to check that the filter is not circular.

export {
  type ClassifiedSlice,
  classifyDisplacement,
  type DocumentDisplacement,
  type RelocationCandidate,
  type SliceClass,
} from './displacement-class.ts';
export {
  CORPUS_REFERENCE_EXPANSION,
  documentBaseline,
  MIN_RATIO_SOURCE_CHARS,
  PLAUSIBLE_BASELINE_MAX,
  PLAUSIBLE_BASELINE_MIN,
  type SliceRatio,
  sliceRatios,
  type SliceSize,
  sliceSizeOf,
} from './displacement-ratio.ts';
export {
  isPlausibleSlice,
  type SliceImplausibility,
  sliceImplausibility,
} from './slice-implausible.ts';

//endregion Displacement barrel
