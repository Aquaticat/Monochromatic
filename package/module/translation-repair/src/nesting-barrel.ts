//region Nesting barrel
// The nesting bound every parse entry measures first: the measure itself, the
// line and inline readers it counts with, the fence and raw html readings it
// skips a stretch by, and the patch gate's reading of the text an edit leaves.
//
// Split out of `index.ts` when that file reached its size budget, on the rule
// that split the other barrels from it: a barrel grows with the surface it
// names, so it is divided rather than exempted.

export {
  firstNestingExcess,
  isStackOverflow,
} from './nesting-bound.ts';
export {
  certainFenceOf,
  fenceOf,
  NO_FENCE,
} from './nesting-fence.ts';
export {
  type HtmlBlock,
  htmlBlockAfter,
  htmlBlockAfterBlank,
} from './nesting-html-block.ts';
export {
  type ScanState,
  scanInline,
} from './nesting-inline-count.ts';
export {
  blanksEnd,
  containerPrefixOf,
  indentationOf,
  isRuleLine,
} from './nesting-line-lexing.ts';
export {
  DELIMITER_BOUND,
  NESTING_BOUND,
} from './nesting-vocabulary.ts';
export {
  isUnreadableReason,
  nestingWithEdit,
  unreadableReason,
} from './patch-nesting.ts';

//endregion Nesting barrel
