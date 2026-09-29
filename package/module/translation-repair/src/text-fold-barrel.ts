//region Text fold barrel
// The folds that decide when two texts count as one: the quote and line-break
// folds for evidence and typography (ledger B24), and the wording key for
// whether a proposal changes the page (ledger B26). Split from `index.ts`,
// which sits at its line budget.

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
