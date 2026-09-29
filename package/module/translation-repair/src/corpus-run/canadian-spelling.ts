import {
  insideEmphasis,
  inTitleCaseHeading,
  nextWordCapitalised,
  opensSentence,
  startsWithCapital,
} from './canadian-spelling-capital.ts';
import { codePointAt, } from '../code-points.ts';
import { isWordCharacter, } from './canadian-date-parts.ts';
import {
  besideNonProse,
  wordsOf,
} from './canadian-spelling-context.ts';
import {
  runEnd,
  runStart,
} from './text-runs.ts';
import {
  CANADIAN_SPELLINGS,
  CAPITALISED_EXCLUDED,
  FREUDIAN_WORDS,
  MOTHER_WORDS,
  POSSESSIVE_DETERMINERS,
} from './canadian-spelling-words.ts';
import {
  inProse,
  type ProtectedRange,
} from './prose-ranges.ts';

//region Canadian spelling
// CLASS ONE HUNDRED THIRTY-FOUR (hulicaijia19, 2026-09-25): the house policy
// says English already on the page in another variety's spelling is respelled
// the Canadian way, yet "compound liquorice tablets" stood on a slice no lane
// rewrote. A closed list of words whose Canadian spelling differs, each with
// no second sense a respelling could damage, is respelled
// (`canadian-spelling-words.ts`). Words with a second sense (meter, check,
// tire, license) are left to the judges.
//
// The audit of 2026-09-26 widened the pass. Inflections of listed stems and
// the forms the house policy names (ledger K3). A capitalised word opening a
// sentence or standing in a title-case heading, which the first pass took for
// a name (ledger K11, K14: `Chinatsu_Suzuki/page.en.md:29`, a heading); a
// capital mid-sentence, after a title, before another capital, inside
// emphasis or in capitals still names someone or a work and keeps its
// spelling. English the original itself writes keeps its spelling (ledger
// K9). A word beside emphasis underscores or a slash between words is prose;
// one inside an identifier, a path, a label or beside a digit is not (ledger
// K10, H14).

/**
 One word respelled, with the span it covered.
 */
export type SpellingRewrite = {
  readonly start: number;
  readonly end: number;
  readonly from: string;
  readonly to: string;
};

/**
 How a word is capitalised.
 */
type WordShape = 'lower' | 'capital' | 'other';

/**
 How a word is capitalised: all lower case, a capital then lower case, or
 anything else (capitals throughout, mixed case), which is never respelled.

 @param word - word as written

 @returns Its shape

 @example
 ```ts
 shapeOf({ word: 'Colour', },); // 'capital'
 ```
 */
function shapeOf(
  { word, }: { readonly word: string; },
): WordShape {
  /**
   Everything after the first letter.
   */
  const rest = word.slice(1,);
  if (word === word.toLowerCase())
    return 'lower';
  return (startsWithCapital({ word, },) && (rest === rest.toLowerCase()))
    ? 'capital'
    : 'other';
}

/**
 The word before one offset, across one space.

 @param text - text under scan

 @param start - word's first offset

 @returns The previous word in lower case, or the empty string

 @example
 ```ts
 previousWord({ text: 'my mum', start: 3, },); // 'my'
 ```
 */
function previousWord(
  {
    text,
    start,
  }: {
    readonly text: string;
    readonly start: number;
  },
): string {
  if (text.charAt(start - 1,) !== ' ')
    return '';
  return text.slice(
    runStart({
      text,
      from: start - 1,
      keeps: isWordCharacter,
    },),
    start - 1,
  )
    .toLowerCase();
}

/**
 What "mum" becomes: "mom" after a possessive, and always when capitalised
 as a form of address.

 @param text - text under scan

 @param start - word's first offset

 @param word - word as written

 @param mother - Canadian form in lower case

 @returns The Canadian form, or the word as written

 @example
 ```ts
 motherWord({ text: 'my mum', start: 3, word: 'mum', mother: 'mom', },); // 'mom'
 ```
 */
function motherWord(
  {
    text,
    start,
    word,
    mother,
  }: {
    readonly text: string;
    readonly start: number;
    readonly word: string;
    readonly mother: string;
  },
): string {
  if (shapeOf({ word, },) === 'capital')
    return `${mother.charAt(0,)
      .toUpperCase()}${mother.slice(1,)}`;
  return POSSESSIVE_DETERMINERS.has(previousWord({
    text,
    start,
  },),)
    ? mother
    : word;
}

/**
 What a capitalised listed word becomes: its Canadian form with the capital
 kept where the capital opens a sentence or styles a title-case heading, and
 the word as written where it names someone or a work.

 @param text - text under scan

 @param start - word's first offset

 @param end - word's exclusive end

 @param word - word as written

 @param canadian - Canadian form in lower case

 @returns The respelled or the written word

 @example
 ```ts
 capitalWord({ text: 'Colors faded.', start: 0, end: 6, word: 'Colors', canadian: 'colours', },); // 'Colours'
 ```
 */
function capitalWord(
  {
    text,
    start,
    end,
    word,
    canadian,
  }: {
    readonly text: string;
    readonly start: number;
    readonly end: number;
    readonly word: string;
    readonly canadian: string;
  },
): string {
  /**
   Where the word stands.
   */
  const place = {
    text,
    start,
  };
  /**
   Whether the capital opens a sentence rather than a name of two words.
   */
  const opens = opensSentence(place,) && (!nextWordCapitalised({
    text,
    end,
  },));
  if (CAPITALISED_EXCLUDED.has(word.toLowerCase(),) || insideEmphasis(place,))
    return word;
  return (opens || inTitleCaseHeading(place,))
    ? `${canadian.charAt(0,)
      .toUpperCase()}${canadian.slice(1,)}`
    : word;
}

/**
 What one word becomes.

 @param text - text under scan

 @param start - word's first offset

 @param end - word's exclusive end

 @param kept - lower-case words the original writes in English

 @returns The Canadian form, or the word as written

 @example
 ```ts
 respelling({ text: 'her favorite', start: 4, end: 12, kept: new Set(), },); // 'favourite'
 ```
 */
function respelling(
  {
    text,
    start,
    end,
    kept,
  }: {
    readonly text: string;
    readonly start: number;
    readonly end: number;
    readonly kept: ReadonlySet<string>;
  },
): string {
  /**
   The word as written.
   */
  const word = text.slice(
    start,
    end,
  );
  /**
   The word in lower case.
   */
  const lower = word.toLowerCase();
  /**
   Its shape.
   */
  const shape = shapeOf({ word, },);
  /**
   Canadian "mom", where the word is "mum".
   */
  const mother = MOTHER_WORDS.get(lower,);
  /**
   Its Canadian spelling, where the list names it.
   */
  const canadian = CANADIAN_SPELLINGS.get(lower,);
  if ((shape === 'other') || kept.has(lower,)
    || besideNonProse({
    text,
    start,
    end,
  },))
    return word;
  if (mother !== undefined) {
    return motherWord({
      text,
      start,
      word,
      mother,
    },);
  }
  if (canadian === undefined)
    return word;
  if (shape === 'lower')
    return canadian;
  return capitalWord({
    text,
    start,
    end,
    word,
    canadian,
  },);
}

/**
 Every listed word in a text's prose, respelled the Canadian way.

 @param text - text under scan

 @param ranges - the text's non-prose ranges

 @param kept - lower-case words the original writes in English, which keep
 their spelling

 @returns Rewrites in order

 @example
 ```ts
 canadianSpellings({ text: 'her favorite color', ranges: [], kept: new Set(), },);
 ```
 */
export function canadianSpellings(
  {
    text,
    ranges,
    kept,
  }: {
    readonly text: string;
    readonly ranges: readonly ProtectedRange[];
    readonly kept: ReadonlySet<string>;
  },
): readonly SpellingRewrite[] {
  /**
   Words that keep their spelling here: the original's English, and "id"
   where the text names the psychoanalytic frame it belongs to (ledger H14:
   beside the ego and the superego, "id" is Freud's, not a handle).
   */
  const held: ReadonlySet<string> = wordsOf({ text, },)
    .isDisjointFrom(FREUDIAN_WORDS,)
    ? kept
    : new Set([
      ...kept,
      'id',
    ],);
  /**
   Rewrites found so far.
   */
  const rewrites: SpellingRewrite[] = [];
  // WHOLE CHARACTERS AT UTF-16 OFFSETS (ledger B21): a cased letter beyond the
  // first plane opens a word as a Latin letter does, so a listed word glued
  // to one is part of a longer token.
  for (let at = 0; at < text.length;) {
    /**
     Whole character at this offset.
     */
    const character = codePointAt({
      text,
      at,
    },);
    if (!isWordCharacter({ character, },)) {
      at += character.length;
      continue;
    }
    /**
     Where this word starts.
     */
    const start = at;
    at = runEnd({
      text,
      from: at,
      keeps: isWordCharacter,
    },);
    /**
     The word as written.
     */
    const from = text.slice(
      start,
      at,
    );
    /**
     What it becomes.
     */
    const to = respelling({
      text,
      start,
      end: at,
      kept: held,
    },);
    if ((to !== from) && inProse({
      ranges,
      start,
      end: at,
    },)) {
      rewrites.push({
        start,
        end: at,
        from,
        to,
      },);
    }
  }
  return rewrites;
}
//endregion Canadian spelling
