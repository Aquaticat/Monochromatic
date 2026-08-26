//region Publish barrel
// What each slice would carry, how a page is assembled from that, and how the
// page is read back against the artifact that produced it.
//
// Split out of `corpus-barrel.ts` when that file reached its line budget, at
// the seam the other two splits used: by AUDIENCE. Everything here answers a
// question about the DELIVERABLE, the mirrored tree of fixed `page.en.md`
// files `#175` made this pipeline's output. The measurement CLIs ask none of
// it, and the three files form one chain: `would-ship-text.ts` says what a
// slice contributes, `publish-fixed.ts` turns that into a page, and
// `published-page-check.ts` reads the page back and refuses one that disagrees.
// `dropped-destinations.ts` asks the page one more deliverable question, whether
// it still links everywhere the source did, and `destinations-line.ts` prints
// the answer's counts beside the tally.

export { destinationsLine, } from './corpus-run/destinations-line.ts';
export {
  collectDestinations,
  type DestinationCheck,
  droppedDestinations,
  markdownDestinations,
  scanUrlRuns,
} from './corpus-run/dropped-destinations.ts';
export {
  ENGLISH_PAGE_FILE,
  FIXED_TREE_DIR,
  fixedPagePath,
  PEOPLE_DIR,
  publishFixedPage,
  shippableReplacements,
} from './corpus-run/publish-fixed.ts';
export {
  ARTIFACT_SUFFIX,
  ARTIFACTS_DIR,
  publishedEntryIds,
  settledEntryIds,
  type VerifiableRun,
  whatThereIsToVerify,
} from './corpus-run/published-tree-listing.ts';
export {
  type MissingWording,
  pageCarriesEveryWording,
  type PageLengthCheck,
  pageWeighsWhatItShould,
  pageWeightRefutes,
  type PageWordingCheck,
  pairPublishedPages,
  type PublishedPairing,
  refusePageThatDisagrees,
} from './corpus-run/published-page-check.ts';
export {
  type PageDisagreement,
  PublishedPageDisagreesError,
} from './corpus-run/published-page-disagreement.ts';
export {
  UnansweredContestSliceError,
  type WouldShipDecider,
  type WouldShipReading,
  type WouldShipSilence,
  type WouldShipSlice,
  type WouldShipSource,
  wouldShipTextFor,
  wouldShipTextPerSlice,
} from './corpus-run/would-ship-text.ts';

//endregion Publish barrel
