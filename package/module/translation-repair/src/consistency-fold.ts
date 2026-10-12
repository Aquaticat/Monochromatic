import { edgeFreeWordsOf, } from './consistency-edge-marks.ts';
import { ConsistencyInvariantError, } from './consistency-invariant-error.ts';
import { normalizePunctuation, } from './quote-normalize.ts';
import { wordStarts, } from './word-bounds.ts';

//region Consistency fold
// WHERE A JUDGE'S QUOTE STANDS IN A PLACE'S OWN ENGLISH. Judges copy the words
// of an English passage with the line break the page wraps at written as a
// space, a curly apostrophe written straight, the closing full stop kept or
// left off, and two quotes of one passage that differ in only those still name
// one span. This reads a quote and the English in one fold (the evidence fold
// of `quote-normalize.ts`, a run of whitespace as one space, a blank line kept
// apart from a space because it is a paragraph boundary), ignores sentence
// punctuation, quotation marks and brackets that the words do not need, and
// space at the quote's two edges (`consistency-edge-marks.ts`), and answers
// where the quote stands in the English as the English holds it, at the
// boundaries of words (`word-bounds.ts`). The span the English holds is what
// every later step uses, never the judge's string.
//
// THE FOLD IS NOT ONE UNIT TO ONE, since a run of whitespace folds to one or two
// units, so the folded English carries a map from each folded unit back to the
// offsets of the original it stands for, and every offset returned indexes the
// English as it was given.
//
// FOLDING A FOLDED TEXT CHANGES NOTHING. A blank line folds to TWO line breaks,
// which read again are two breaks and so a blank line again, where one break
// stands for a soft wrap and folds to a space; a quote that spans a paragraph
// boundary therefore locates whether its caller folded it first or not.

/**
 Where a quote stands in an English.

 @example
 ```ts
 const found: SpanSearch = { kind: 'once', start: 4, end: 11, };
 ```
 */
export type SpanSearch =
  | {
    /**
     The quote's words stand nowhere in the English.
     */
    readonly kind: 'none';
  }
  | {
    /**
     The quote's words stand exactly once.
     */
    readonly kind: 'once';

    /**
     Offset in the English where the span starts.
     */
    readonly start: number;

    /**
     Exclusive offset in the English where the span ends.
     */
    readonly end: number;
  }
  | {
    /**
     The quote's words stand more than once, overlaps included.
     */
    readonly kind: 'many';
  };

/**
 A text in the fold, with the offsets of the original each folded unit stands for.
 */
type FoldedText = {
  /**
   The folded text.
   */
  readonly folded: string;

  /**
   Offset in the original where the original stretch of each folded UTF-16
   unit starts.
   */
  readonly starts: readonly number[];

  /**
   Exclusive offset in the original where it ends.
   */
  readonly ends: readonly number[];
};

/**
 Whether a character is whitespace.

 @param character - one whole character

 @returns Whether it is whitespace

 @example
 ```ts
 const space = isWhitespace({ character: '\n', },); // true
 ```
 */
function isWhitespace({ character, }: { readonly character: string; },): boolean {
  // TRIM CHANGES A SINGLE CHARACTER ONLY WHEN IT IS WHITESPACE, which is the
  // question here (spacing); the character is not compared with the empty string.
  return character.trim() !== character;
}

/**
 Units a blank line folds to: two line breaks, so the folded text read again
 holds a blank line again.
 */
const BLANK_LINE = [
  '\n',
  '\n',
] as const;

/**
 Units any other run of whitespace folds to.
 */
const SPACE = [' ',] as const;

/**
 Folds a text and keeps the offsets of the original each folded unit stands
 for. A run of whitespace holding two line breaks or more is a blank line, a
 paragraph boundary, and folds to two line breaks; any other run folds to one
 space. Every unit of a run stands for the whole run.

 @param text - text in the original

 @returns The folded text and the offsets of the original each folded unit stands for

 @example
 ```ts
 const { folded, } = foldWithOffsets({ text: 'girl,\nwasn’t  she', },); // "girl, wasn't she"
 ```
 */
function foldWithOffsets({ text, }: { readonly text: string; },): FoldedText {
  /**
   Folded units, each with the original stretch it stands for.
   */
  const units: {
    readonly unit: string;
    readonly start: number;
    readonly end: number
  }[] = [];
  /**
   Whitespace run being read: where it began and ended, and how many line breaks it holds.
   */
  const run = {
    open: false,
    start: 0,
    end: 0,
    breaks: 0,
  };
  /**
   Closes the whitespace run being read, folded to one unit.
   */
  function closeRun(): void {
    if (!run.open)
      return;
    for (const unit of (run.breaks >= 2) ? BLANK_LINE : SPACE) {
      units.push({
        unit,
        start: run.start,
        end: run.end,
      },);
    }
    run.open = false;
  }
  /**
   Offset in the original reached so far.
   */
  const reached = { at: 0, };
  for (const character of normalizePunctuation({ text, },)) {
    if (isWhitespace({ character, },)) {
      if (!run.open) {
        run.open = true;
        run.start = reached.at;
        run.breaks = 0;
      }
      run.end = reached.at + character.length;
      if (character === '\n')
        run.breaks += 1;
    }
    else {
      closeRun();
      for (
        let index = 0;
        index < character.length;
        index += 1
      ) {
        units.push({
          unit: character.charAt(index,),
          start: reached.at,
          end: reached.at + character.length,
        },);
      }
    }
    reached.at += character.length;
  }
  closeRun();
  return {
    folded: units.map(function unitOf({ unit, },): string {
      return unit;
    },)
      .join('',),
    starts: units.map(function startOf({ start, },): number {
      return start;
    },),
    ends: units.map(function endOf({ end, },): number {
      return end;
    },),
  };
}

/**
 The words of a quote in the fold, without the sentence punctuation, space and
 invisible characters at its two edges, and without a quotation mark or a
 bracket at an edge that pairs with nothing inside the words or encloses all of
 them. Reading the result again gives the result.

 @param text - quote as a judge gave it, or the folded words of one

 @returns The folded words, empty when the quote shows a reader nothing

 @example
 ```ts
 const words = foldedWordsOf({ text: '“So she was a girl, wasn’t she?”', },); // "So she was a girl, wasn't she"
 ```
 */
export function foldedWordsOf({ text, }: { readonly text: string; },): string {
  return edgeFreeWordsOf({
    points: Array.from(foldWithOffsets({ text, },)
      .folded,),
  },)
    .join('',);
}

/**
 Where a quote's words stand in an English, once, never or more than once, at
 the boundaries of words: a Latin letter or digit at the first or last
 character of the words may not have another beside it in the English, so `so`
 is not found inside `also`. Han text needs no boundary.

 @param haystack - the English as the place holds it

 @param words - quote as a judge gave it, or the folded words of one

 @returns That the words stand nowhere, the offsets of the one span they name
 in the English, or that they stand more than once (a stand inside a longer word
 is no stand); nowhere for a quote that shows a reader nothing

 @throws {@link ConsistencyInvariantError} when a found position has no offsets
 in the original, since every folded unit stands for a stretch of it

 @example
 ```ts
 const found = locateWords({ haystack: 'The cat naps.', words: 'cat naps.', },); // { kind: 'once', start: 4, end: 12 }
 ```
 */
export function locateWords(
  {
    haystack,
    words,
  }: {
    readonly haystack: string;
    readonly words: string;
  },
): SpanSearch {
  /**
   The words to look for.
   */
  const needle = foldedWordsOf({ text: words, },);
  if (needle === '')
    return { kind: 'none', };
  /**
   The English in the fold with its offsets.
   */
  const {
    folded,
    starts,
    ends,
  } = foldWithOffsets({ text: haystack, },);
  /**
   Where the words stand in the folded English, at word boundaries, overlaps included.
   */
  const stands = wordStarts({
    text: folded,
    needle,
    end: 'word',
  },);
  /**
   Where the words first stand in the folded English.
   */
  const [at,] = stands;
  if (at === undefined)
    return { kind: 'none', };
  if (stands.length > 1)
    return { kind: 'many', };
  /**
   Offset in the English where the first folded unit's stretch starts.
   */
  const start = starts[at];
  /**
   Exclusive offset in the English where the last folded unit's stretch ends.
   */
  const end = ends[(at + needle.length) - 1];
  if ((start === undefined) || (end === undefined)) {
    throw new ConsistencyInvariantError({ invariant:
      `a folded position ${String(at,)} of the English has no offsets in it, and every folded unit stands for a stretch of it`, },);
  }
  return {
    kind: 'once',
    start,
    end,
  };
}

/**
 How many times a quote's words stand in an English, at word boundaries,
 overlaps included, read in the same fold as {@link locateWords}.

 @param haystack - the English as the place holds it

 @param words - quote as a judge gave it, or the folded words of one

 @returns The number of stands; none for a quote that shows a reader nothing

 @example
 ```ts
 const stands = standsOf({ haystack: 'The cat naps. The cat naps.', words: 'The cat naps', },); // 2
 ```
 */
export function standsOf(
  {
    haystack,
    words,
  }: {
    readonly haystack: string;
    readonly words: string;
  },
): number {
  return wordStarts({
    text: foldWithOffsets({ text: haystack, },)
      .folded,
    needle: foldedWordsOf({ text: words, },),
    end: 'word',
  },)
    .length;
}

//endregion Consistency fold
