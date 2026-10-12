//region Repeat groups barrel
// The helpers behind `repeatGroupsOf` that the package's built-artifact tests
// call directly: the constants of the rule, the order, the finders and the
// wording reader. `repeatGroupsOf` and its types are exported from the index.

export {
  BREAK,
  CLAUSE_BOUNDARY,
  MAXIMAL_REPEAT_MINIMUM,
  QUOTE_CLOSERS,
  QUOTE_OPENERS,
  REFRAIN_CLAUSE_MINIMUM,
  REFRAIN_PREFIX_MINIMUM,
  REFRAIN_SLOT_MAXIMUM,
  REFRAIN_SLOT_MINIMUM,
  REFRAIN_SUFFIX_MINIMUM,
  STRAIGHT_QUOTE,
  TAG_LETTERS,
  URL_SCHEMES,
} from './repeat-groups-bounds.ts';
export { compareFoundRepeats, } from './repeat-groups-order.ts';
export { disjointRepeatsOf, } from './repeat-groups-overlap.ts';
export {
  clausesOf,
  refrainFramesOf,
} from './repeat-groups-refrain.ts';
export {
  quotedCountsOf,
  touchesQuotation,
} from './repeat-groups-quotation.ts';
export { maximalRunsOf, } from './repeat-groups-runs.ts';
export {
  blankedAt,
  cutEndAt,
  cutSetOf,
  hasMarkupOpener,
  hiddenCoverOf,
  hiddenRangesOf,
  wordingEndAt,
  wordingStreamOf,
} from './repeat-groups-wording.ts';

//endregion Repeat groups barrel
