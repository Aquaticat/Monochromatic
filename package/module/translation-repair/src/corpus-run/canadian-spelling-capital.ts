import {
  isCasedLetter,
  isDigit,
  runEnd,
} from './canadian-date-parts.ts';
import {
  isWordCharacter,
  lineStartOf,
  runStart,
} from './canadian-spelling-context.ts';
import {
  NAME_TITLES,
  TITLE_SMALL_WORDS,
} from './canadian-spelling-words.ts';

//region Canadian spelling capitals
// Whether a capitalised listed word's capital opens a sentence or styles a
// title-case heading, so the word is respelled with its capital kept, or
// names someone or a work, so it keeps its spelling (ledger K11: the first
// pass took every capital for a name, and the archive's "## Heaven’s Favor"
// for 上天的眷顾 shipped American).

/**
 Characters that may open a line before its first word: space, heading,
 quote, list and emphasis marks, and a numbered item's digits.
 */
const LINE_OPENERS: ReadonlySet<string> = new Set([
  ' ',
  '\t',
  '\u00A0',
  '#',
  '>',
  '-',
  '*',
  '+',
  '.',
  ')',
  '(',
  '[',
  '_',
  '"',
  '“',
  '‘',
  '\'',
],);

/**
 Marks that make a line's opening a heading, a quote or a list item.
 */
const LINE_MARKERS: readonly string[] = [
  '#',
  '>',
  '- ',
  '* ',
  '+ ',
  '. ',
  ') ',
];

/**
 Characters that may stand between a sentence's closing mark and its next
 word.
 */
const SENTENCE_GAP: ReadonlySet<string> = new Set([
  ' ',
  '\t',
  '\n',
  '\u00A0',
  '(',
  '[',
  '*',
  '_',
  '"',
  '“',
  '‘',
  '\'',
  '”',
  '’',
],);

/**
 Marks that end a sentence.
 */
const SENTENCE_ENDS: ReadonlySet<string> = new Set([
  '.',
  '!',
  '?',
  '…',
],);

/**
 List markers an emphasis count skips.
 */
const LIST_MARKERS: readonly string[] = [
  '* ',
  '+ ',
  '- ',
];

/**
 Whether a word starts with a capital letter.

 @param word - word as written

 @returns Whether its first character is an upper-case letter

 @example
 ```ts
 startsWithCapital({ word: 'Colour', },); // true
 ```
 */
export function startsWithCapital(
  { word, }: { readonly word: string; },
): boolean {
  /**
   The word's first character.
   */
  const initial = word.charAt(0,);
  return initial !== initial.toLowerCase();
}

/**
 Whether one character may open a line before its first word.

 @param character - one UTF-16 unit

 @returns Whether it is an opener or a digit

 @example
 ```ts
 opensLine({ character: '#', },); // true
 ```
 */
function opensLine(
  { character, }: { readonly character: string; },
): boolean {
  return LINE_OPENERS.has(character,) || isDigit({ character, },);
}

/**
 Whether one character may stand between a sentence's end and its next word.

 @param character - one UTF-16 unit

 @returns Whether it is a gap character

 @example
 ```ts
 isSentenceGap({ character: '”', },); // true
 ```
 */
function isSentenceGap(
  { character, }: { readonly character: string; },
): boolean {
  return SENTENCE_GAP.has(character,);
}

/**
 Whether one character is a heading mark.

 @param character - one UTF-16 unit

 @returns Whether it is `#`

 @example
 ```ts
 isHeadingMark({ character: '#', },); // true
 ```
 */
function isHeadingMark(
  { character, }: { readonly character: string; },
): boolean {
  return character === '#';
}

/**
 Whether one character is no letter.

 @param character - one UTF-16 unit

 @returns Whether it has no case

 @example
 ```ts
 isNoLetter({ character: '*', },); // true
 ```
 */
function isNoLetter(
  { character, }: { readonly character: string; },
): boolean {
  return !isCasedLetter({ character, },);
}

/**
 Whether a word opens a sentence: at the text's or a paragraph's start, after
 a heading, quote or list marker, or after a sentence's closing mark that no
 title abbreviation or initial wrote ("Mr. Gray", "J. Gray"). A word opening
 a line that only continues its paragraph opens no sentence, so a name
 wrapped onto a new line keeps its capital.

 @param text - text under scan

 @param start - word's first offset

 @returns Whether the word is a sentence's first

 @example
 ```ts
 opensSentence({ text: 'The cat napped. Behavior was calm.', start: 16, },); // true
 ```
 */
export function opensSentence(
  {
    text,
    start,
  }: {
    readonly text: string;
    readonly start: number;
  },
): boolean {
  /**
   Where the word's line starts.
   */
  const lineStart = lineStartOf({
    text,
    at: start,
  },);
  /**
   Whether a heading, quote or list marker alone opens the line. The marker
   is found by index, not by a set of the prefix's characters, since a
   marker such as "- " is two characters long.
   */
  const marked = (runEnd({
    text,
    from: lineStart,
    keeps: opensLine,
  },) >= start) && LINE_MARKERS.some(function carries(marker,): boolean {
    /**
     Where the marker first stands on the line.
     */
    const markerAt = text.indexOf(
      marker,
      lineStart,
    );
    return (markerAt !== (-1)) && ((markerAt + marker.length) <= start);
  },);
  /**
   Offset just past the last character before the word that is no gap.
   */
  const closeEnd = runStart({
    text,
    from: start,
    keeps: isSentenceGap,
  },);
  /**
   The word before the closing mark.
   */
  const before = text.slice(
    runStart({
      text,
      from: closeEnd - 1,
      keeps: isCasedLetter,
    },),
    closeEnd - 1,
  );
  /**
   Whether a blank line, or the text's start, opens the word's paragraph.
   */
  const paragraphStart = (closeEnd === 0)
    || text.slice(
    closeEnd,
    start,
  )
    .includes('\n\n',);
  /**
   Whether a sentence's closing mark, not a title's or an initial's period,
   stands before the word.
   */
  const afterSentence = SENTENCE_ENDS.has(text.charAt(closeEnd - 1,),) && (before.length !== 1)
    && (!NAME_TITLES.has(before,));
  return marked || paragraphStart
    || afterSentence;
}

/**
 Whether a word stands in a heading written in title case, whose capitals
 are styling rather than names ("## The Cat’s Favor"); in a sentence-case
 heading a capital mid-line names someone ("## A visit to the Lincoln
 Center").

 @param text - text under scan

 @param start - word's first offset

 @returns Whether the word's line is a title-case heading

 @example
 ```ts
 inTitleCaseHeading({ text: '## The Cat’s Favor', start: 13, },); // true
 ```
 */
export function inTitleCaseHeading(
  {
    text,
    start,
  }: {
    readonly text: string;
    readonly start: number;
  },
): boolean {
  /**
   Where the line ends.
   */
  const newline = text.indexOf(
    '\n',
    start,
  );
  /**
   The line.
   */
  const line = text.slice(
    lineStartOf({
      text,
      at: start,
    },),
    (newline === (-1)) ? text.length : newline,
  )
    .trimStart();
  /**
   The heading's words, each from its first letter.
   */
  const words = line.slice(runEnd({
    text: line,
    from: 0,
    keeps: isHeadingMark,
  },),)
    .split(' ',)
    .map(function fromFirstLetter(token,): string {
      return token.slice(runEnd({
        text: token,
        from: 0,
        keeps: isNoLetter,
      },),);
    },)
    .filter(function hasLetter(word,): boolean {
      return word !== '';
    },);
  return line.startsWith('#',) && words.every(function capitalised(word,): boolean {
    return startsWithCapital({ word, },) || TITLE_SMALL_WORDS.has(word.slice(
      0,
      runEnd({
        text: word,
        from: 0,
        keeps: isCasedLetter,
      },),
    ),);
  },);
}

/**
 Whether a word stands inside emphasis on its line, as a work's title does
 (`*The Color of Cats*`): an odd count of asterisks, or of underscores at a
 word's edge, before it on the line, a leading list marker aside.

 @param text - text under scan

 @param start - word's first offset

 @returns Whether the word is emphasised

 @example
 ```ts
 insideEmphasis({ text: 'Reading *The Color of Cats*', start: 13, },); // true
 ```
 */
export function insideEmphasis(
  {
    text,
    start,
  }: {
    readonly text: string;
    readonly start: number;
  },
): boolean {
  /**
   The line before the word.
   */
  const line = text.slice(
    lineStartOf({
      text,
      at: start,
    },),
    start,
  );
  /**
   That line with a leading list marker cut.
   */
  const before = LIST_MARKERS.some(function listed(marker,): boolean {
    return line.startsWith(marker,);
  },)
    ? line.slice(2,)
    : line;
  /**
   Counts of asterisks, and of underscores with no word character on one
   side, before the word.
   */
  const counts = {
    stars: 0,
    unders: 0,
  };
  for (let at = 0; at < before.length; at += 1) {
    /**
     Whether word characters stand on both sides.
     */
    const inside = isWordCharacter({ character: before.charAt(at - 1,), },)
      && isWordCharacter({ character: before.charAt(at + 1,), },);
    if (before.charAt(at,) === '*')
      counts.stars += 1;
    else if ((before.charAt(at,) === '_') && (!inside))
      counts.unders += 1;
  }
  return ((counts.stars % 2) === 1) || ((counts.unders % 2) === 1);
}

/**
 Whether the next word after one offset, across one space, starts with a
 capital, so a capitalised word before it is part of a name ("Center
 Parcs").

 @param text - text under scan

 @param end - offset just past the word

 @returns Whether a capitalised word follows

 @example
 ```ts
 nextWordCapitalised({ text: 'Center Parcs hosted', end: 6, },); // true
 ```
 */
export function nextWordCapitalised(
  {
    text,
    end,
  }: {
    readonly text: string;
    readonly end: number;
  },
): boolean {
  /**
   First character of the next word.
   */
  const next = text.charAt(end + 1,);
  return (text.charAt(end,) === ' ') && isCasedLetter({ character: next, },)
    && startsWithCapital({ word: next, },);
}

//endregion Canadian spelling capitals
