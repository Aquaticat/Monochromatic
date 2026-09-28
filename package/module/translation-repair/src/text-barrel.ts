//region Text barrel
// Character tests the floors and guards share, exported so each is tested once
// where it is defined rather than through every caller (audit area six).

export {
  isAsciiAlphanumeric,
  isAsciiDigit,
  isAsciiLetter,
  isLowerHexDigit,
} from './ascii-letters.ts';
export { longestRunOf, } from './character-run.ts';
export { isHanCharacter, } from './han-only-text.ts';
export {
  continuesLatinWord,
  isCombiningMark,
  isLatinLetter,
  isLatinLetterOrMark,
  isLatinWordCharacter,
  type LatinWord,
  latinWordSpans,
  lowerCaseLatinWords,
} from './latin-letters.ts';
export { isIdeograph, } from './preservation-tokens.ts';
export {
  carriesContent,
  pastQuoteMarkers,
} from './quote-line.ts';

//endregion Text barrel
