//region Text fold barrel
// The folds that decide when two texts count as one: the quote and line-break
// folds for evidence and typography (ledger B24), and the wording key for
// whether a proposal changes the page (ledger B26), and the test for the white
// corner brackets the evidence fold writes as the single mark. Split from
// `index.ts`, which sits at its line budget.

export {
  closingJointsOf,
  joinedMarksOf,
  markPastRunOf,
} from './consistency-closing-marks.ts';
export { marksPastMarkupOf, } from './consistency-marks-past-markup.ts';
export { isCornerBracket, } from './consistency-corner-brackets.ts';
export {
  foldWithOffsets,
  type OffsetFoldedText,
  offsetsInFold,
} from './consistency-fold-offsets.ts';
export { cutsWord, } from './consistency-word-joints.ts';
export {
  collapseLineBreaks,
  collapseSoftLineBreaks,
  normalizePunctuation,
  straightenProseQuotes,
  straightenQuotes,
} from './quote-normalize.ts';
export {
  sameWording,
  wordingKey,
} from './wording-key.ts';

//endregion Text fold barrel
