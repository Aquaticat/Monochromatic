//region Text barrel
// Character tests the floors and guards share, exported so each is tested once
// where it is defined rather than through every caller (audit area six).

export {
  isAsciiAlphanumeric,
  isAsciiDigit,
  isAsciiDigits,
  isAsciiLetter,
  isAsciiLowerLetter,
  isLowerHexDigit,
} from './ascii-letters.ts';
export { longestRunOf, } from './character-run.ts';
export { isHanCharacter, } from './han-only-text.ts';
export {
  continuesLatinWord,
  foldLatinWord,
  foldedLatinWords,
  isCombiningMark,
  isLatinCapital,
  isLatinLetter,
  isLatinLetterOrMark,
  isLatinWordCharacter,
  type LatinWord,
  latinWordSpans,
  lowerCaseLatinWords,
} from './latin-letters.ts';
export { opensMdxTag, } from './mdx-tag-start.ts';
export {
  carriesName,
  nameProjection,
  type NameProjection,
  projectName,
} from './name-projection.ts';
export { isIdeograph, } from './preservation-tokens.ts';
export {
  carriesContent,
  pastQuoteMarkers,
} from './quote-line.ts';
export {
  carriesWord,
  type WordEnd,
  wordStarts,
} from './word-bounds.ts';

//endregion Text barrel
