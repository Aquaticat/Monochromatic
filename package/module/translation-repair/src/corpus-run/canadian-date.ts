import {
  inProse,
  type ProtectedRange,
} from './prose-ranges.ts';

//region Canadian date
// CLASS ONE HUNDRED THIRTY-FOUR (hulicaijia19, 2026-09-25): the page is
// Canadian English, which writes a date month first ("April 29", "March 13,
// 2024"), yet the archive's "29th April" and "On 4 May" stood beside the
// bench's "March 13" on one page. A day number (1 to 31, with or without its
// ordinal suffix) followed by a full month name is rewritten month first, a
// year after it taking a comma. A day that closes a range ("1st to 3rd June")
// stands aside, since moving its month would split the range.

/**
 Months by their English names, capitalised as the page writes them.
 */
const MONTHS: ReadonlySet<string> = new Set([
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
],);

/**
 Suffixes an ordinal day may carry.
 */
const ORDINAL_SUFFIXES: readonly string[] = [
  'st',
  'nd',
  'rd',
  'th',
];

/**
 Words that make the day after them the end of a range.
 */
const RANGE_WORDS: ReadonlySet<string> = new Set([
  'to',
  'and',
  'through',
  'until',
  'till',
],);

/**
 Characters that may stand right before a day number in prose.
 */
const DAY_OPENERS: ReadonlySet<string> = new Set([
  ' ',
  '\n',
  '\t',
  '(',
  '"',
  '“',
  '‘',
  '\'',
  '*',
  '_',
  '[',
],);

/**
 Highest day of a month.
 */
const LAST_DAY = 31;

/**
 Digits a year carries.
 */
const YEAR_DIGITS = 4;

/**
 Most digits a day number carries.
 */
const DAY_DIGITS = 2;

/**
 One date rewritten, with the span it covered.
 */
export type DateRewrite = {
  readonly start: number;
  readonly end: number;
  readonly from: string;
  readonly to: string;
};

/**
 What reading a date at one offset found.
 */
type DateReading =
  | {
    readonly kind: 'date';
    readonly rewrite: DateRewrite
  }
  | { readonly kind: 'none'; };

/**
 Reading where no day-first date starts.
 */
const NO_DATE: DateReading = { kind: 'none', };

/**
 Whether one character is an ASCII digit.

 @param character - one UTF-16 unit

 @returns Whether it is 0 to 9

 @example
 ```ts
 isDigit({ character: '4', },); // true
 ```
 */
function isDigit(
  { character, }: { readonly character: string; },
): boolean {
  return (character >= '0') && (character <= '9');
}

/**
 Whether one character is a letter in any script with case.

 @param character - one UTF-16 unit

 @returns Whether it changes under case mapping

 @example
 ```ts
 isCasedLetter({ character: 'M', },); // true
 ```
 */
function isCasedLetter(
  { character, }: { readonly character: string; },
): boolean {
  return character.toLowerCase() !== character.toUpperCase();
}

/**
 Where a run of characters one test keeps ends.

 @param text - text under scan

 @param from - where the run starts

 @param keeps - test each character of the run passes

 @returns Offset of the first character the test refuses, or the text's length

 @example
 ```ts
 runEnd({ text: '12 May', from: 0, keeps: isDigit, },); // 2
 ```
 */
function runEnd(
  {
    text,
    from,
    keeps,
  }: {
    readonly text: string;
    readonly from: number;
    readonly keeps: (character: { readonly character: string; },) => boolean;
  },
): number {
  for (let at = from; at < text.length; at += 1) {
    if (!keeps({ character: text.charAt(at,), },))
      return at;
  }
  return text.length;
}

/**
 Whether the word before one offset makes a day there the end of a range.

 @param text - text under scan

 @param at - offset of the day number

 @returns Whether a range word or dash precedes it

 @example
 ```ts
 closesRange({ text: '1st to 3rd June', at: 7, },); // true
 ```
 */
function closesRange(
  {
    text,
    at,
  }: {
    readonly text: string;
    readonly at: number;
  },
): boolean {
  /**
   Text before the day, trailing spaces cut.
   */
  const before = text.slice(
    0,
    at,
  )
    .trimEnd();
  /**
   Last character before the day.
   */
  const last = before.at(-1);
  if ((last === '-') || (last === '–')
    || (last === '—'))
    return true;
  /**
   Last word before the day.
   */
  const word = before.slice(before.lastIndexOf(' ',) + 1,)
    .toLowerCase();
  return RANGE_WORDS.has(word,);
}

/**
 Reads a day-first date starting at one offset.

 @param text - text under scan

 @param at - offset of the first digit

 @returns The rewrite, or none where no day-first date starts here

 @example
 ```ts
 readDate({ text: 'On 4 May', at: 3, },); // { kind: 'date', rewrite: { start: 3, end: 8, from: '4 May', to: 'May 4' } }
 ```
 */
function readDate(
  {
    text,
    at,
  }: {
    readonly text: string;
    readonly at: number;
  },
): DateReading {
  /**
   Where the day's digits end.
   */
  const dayEnd = runEnd({
    text,
    from: at,
    keeps: isDigit,
  },);
  /**
   The day number.
   */
  const day = Number(text.slice(
    at,
    dayEnd,
  ),);
  if (((dayEnd - at) > DAY_DIGITS) || (day < 1)
    || (day > LAST_DAY))
    return NO_DATE;
  /**
   Ordinal suffix standing after the digits, or the empty string.
   */
  const suffix = ORDINAL_SUFFIXES.find(function stands(candidate,): boolean {
    return text.startsWith(
      candidate,
      dayEnd,
    );
  },) ?? '';
  /**
   Where the space before the month stands.
   */
  const gap = dayEnd + suffix.length;
  if (text.charAt(gap,) !== ' ')
    return NO_DATE;
  /**
   Where the month's letters end.
   */
  const monthEnd = runEnd({
    text,
    from: gap + 1,
    keeps: isCasedLetter,
  },);
  /**
   The word after the day.
   */
  const month = text.slice(
    gap + 1,
    monthEnd,
  );
  if (!MONTHS.has(month,))
    return NO_DATE;
  /**
   Where a year after the month would end.
   */
  const yearEnd = monthEnd + 1
    + YEAR_DIGITS;
  /**
   Whether a four-digit year stands after the month and ends there.
   */
  const hasYear = (text.charAt(monthEnd,) === ' ')
    && (runEnd({
      text,
      from: monthEnd + 1,
      keeps: isDigit,
    },) === yearEnd);
  /**
   Where the rewritten span ends.
   */
  const end = hasYear ? yearEnd : monthEnd;
  return {
    kind: 'date',
    rewrite: {
      start: at,
      end,
      from: text.slice(
        at,
        end,
      ),
      to: hasYear
        ? `${month} ${String(day,)}, ${text.slice(
          monthEnd + 1,
          yearEnd,
        )}`
        : `${month} ${String(day,)}`,
    },
  };
}

/**
 Every day-first date in a text's prose, rewritten month first.

 @param text - text under scan

 @param ranges - the text's non-prose ranges

 @returns Rewrites in order, none overlapping

 @example
 ```ts
 monthFirstDates({ text: 'On 4 May', ranges: [], },);
 ```
 */
export function monthFirstDates(
  {
    text,
    ranges,
  }: {
    readonly text: string;
    readonly ranges: readonly ProtectedRange[];
  },
): readonly DateRewrite[] {
  /**
   Rewrites found so far.
   */
  const rewrites: DateRewrite[] = [];
  for (let at = 0; at < text.length; at += 1) {
    /**
     Character before the candidate day.
     */
    const before = text.charAt(at - 1,);
    if ((!isDigit({ character: text.charAt(at,), },)) || ((at > 0) && (!DAY_OPENERS.has(before,))))
      continue;
    /**
     The date starting here, if any.
     */
    const reading = readDate({
      text,
      at,
    },);
    if (reading.kind === 'none')
      continue;
    /**
     The rewrite that date takes.
     */
    const { rewrite, } = reading;
    if (closesRange({
      text,
      at,
    },)
      || (!inProse({
        ranges,
        start: rewrite.start,
        end: rewrite.end,
      },)))
      continue;
    rewrites.push(rewrite,);
    at = rewrite.end - 1;
  }
  return rewrites;
}
//endregion Canadian date
