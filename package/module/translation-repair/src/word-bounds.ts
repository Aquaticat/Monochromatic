import {
  codePointAt,
  codePointBefore,
} from './code-points.ts';
import { continuesLatinWord, } from './latin-letters.ts';

//region Word bounds
// ONE READING OF A WORD OR PHRASE INSIDE A TEXT (ledger B23), the glossary's
// rule (ledger C1, `glossary-match.ts`) for callers that do not fold: an edge
// of the needle that is a Latin letter, a digit or a combining mark matches
// only where the text's neighbour at that edge continues no Latin word, and
// a Han edge needs no boundary, since Chinese writes no spaces. A raw
// substring read "as an ai" inside "as an aide", "i cannot" inside "taxi
// cannot" and "load" inside "download". Neighbours are read as whole
// characters (`code-points.ts`, ledger B22).

/**
 How a needle may end where the text goes on: at a word boundary, or open to
 any continuation (a marker read as the start of a word, so "load" is found
 in "loaded" but not in "download").
 */
export type WordEnd = 'word' | 'open';

/**
 Every start of a needle in a text where each of its Latin edges stands at a
 word boundary.

 @param text - text searched

 @param needle - word or phrase looked for

 @param end - whether the needle's end needs a boundary too

 @returns Start offsets in ascending order, empty where the needle is absent
 or empty

 @example
 ```ts
 wordStarts({ text: 'an aide as an ai', needle: 'as an ai', end: 'word', },); // [8]
 ```
 */
export function wordStarts(
  {
    text,
    needle,
    end,
  }: {
    readonly text: string;
    readonly needle: string;
    readonly end: WordEnd;
  },
): readonly number[] {
  if (needle === '')
    return [];
  /**
   Whether the needle opens on a Latin word character, so its start needs a
   boundary.
   */
  const opensLatin = continuesLatinWord({
    character: codePointAt({
      text: needle,
      at: 0,
    },),
  },);
  /**
   Whether the needle closes on one, so a bounded end needs a boundary.
   */
  const closesLatin = (end === 'word') && continuesLatinWord({
    character: codePointBefore({
      text: needle,
      at: needle.length,
    },),
  },);
  /**
   Starts found so far; a linear cursor scan, since the text is unbounded.
   */
  const starts: number[] = [];
  for (let at = text.indexOf(needle,); at !== (-1); at = text.indexOf(
    needle,
    at + 1,
  )) {
    /**
     Whether the match runs on from a word before it.
     */
    const joinedBefore = opensLatin && continuesLatinWord({
      character: codePointBefore({
        text,
        at,
      },),
    },);
    /**
     Whether a word runs on after it.
     */
    const joinedAfter = closesLatin && continuesLatinWord({
      character: codePointAt({
        text,
        at: at + needle.length,
      },),
    },);
    if ((!joinedBefore) && (!joinedAfter))
      starts.push(at,);
  }
  return starts;
}

/**
 Whether a text carries a word or phrase with its Latin edges at word
 boundaries.

 @param text - text searched

 @param needle - word or phrase looked for

 @param end - whether the needle's end needs a boundary too

 @returns Whether some occurrence stands apart

 @example
 ```ts
 carriesWord({ text: 'the cat served as an aide', needle: 'as an ai', end: 'word', },); // false
 ```
 */
export function carriesWord(
  {
    text,
    needle,
    end,
  }: {
    readonly text: string;
    readonly needle: string;
    readonly end: WordEnd;
  },
): boolean {
  /**
   Starts where the needle stands apart.
   */
  const starts = wordStarts({
    text,
    needle,
    end,
  },);
  return starts.length > 0;
}

//endregion Word bounds
