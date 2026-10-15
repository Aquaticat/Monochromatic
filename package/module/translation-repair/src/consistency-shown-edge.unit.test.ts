/**
 Tests for the word test at the edge of a located span (n156, W2). The test reads the text a reader sees: a backslash escape or a
 character reference is its shown character, a default-ignorable character is transparent, and an ampersand between two word
 characters joins them as a hyphen does. It runs on the final edges, after a quote that began inside a unit was widened to the
 whole unit.

 Fixtures are cat-themed invention mirroring corpus structure only.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { cutsShownWord, } from '../dist/final/node/index.mjs';

/**
 Whether the span the quote names in a text cuts a word a reader sees.

 @param text - the English as written

 @param quote - the written characters of the span, found once in the text

 @param needle - the words the judge quoted, whose first and last characters say which edges are word edges, the quote itself where absent

 @returns Whether an edge of the span stands inside a shown word

 @example
 ```ts
 spanCuts({ text: 'See k&#105;ttens now', quote: 'ttens', },); // true
 ```
 */
function spanCuts(
  {
    text,
    quote,
    needle = quote,
  }: {
    readonly text: string;
    readonly quote: string;
    readonly needle?: string;
  },
): boolean {
  /**
   Where the span starts.
   */
  const start = text.indexOf(quote,);
  return cutsShownWord({
    text,
    start,
    end: start + quote.length,
    needle,
  },);
}

await describe({
  name: cutsShownWord.name,
  children: [
    it({
      name: 'CUTS A WORD WHEN THE NEIGHBOUR IS A UNIT THAT SHOWS A LETTER: a numeric reference before the start and after the end',
      fn: async () => {
        expect([
          spanCuts({ text: 'See k&#105;ttens now', quote: 'ttens', },),
          spanCuts({ text: 'See kitten&#115; now', quote: 'kitten', },),
          spanCuts({ text: 'See kitten&#115; now', quote: 'kitten&#115;', },),
        ],).toEqual([true, true, false,],);
      },
    },),
    it({
      name: 'READS A DEFAULT-IGNORABLE CHARACTER AS NOT THERE: a soft hyphen reference or a zero-width space beside the span lets the '
        + 'letter beyond it join the word',
      fn: async () => {
        expect([
          spanCuts({ text: 'See kit&shy;tens now', quote: 'tens', },),
          spanCuts({ text: 'See kitt&shy;ens now', quote: 'kitt', },),
          spanCuts({ text: 'See kit\u{200B}tens now', quote: 'tens', },),
          spanCuts({ text: 'See kitt\u{200B}ens now', quote: 'kitt', },),
        ],).toEqual([true, true, true, true,],);
      },
    },),
    it({
      name: 'JOINS TWO WORD CHARACTERS THROUGH AN AMPERSAND, a plain one and a reference that shows one, as a hyphen does',
      fn: async () => {
        expect([
          spanCuts({ text: 'Call AT&amp;T now', quote: 'AT', },),
          spanCuts({ text: 'Call AT&amp;T now', quote: 'T now', },),
          spanCuts({ text: 'Our R&D team', quote: 'R', },),
          spanCuts({ text: 'Our R&D team', quote: 'D team', },),
        ],).toEqual([true, true, true, true,],);
      },
    },),
    it({
      name: 'CUTS A WORD WHEN A QUOTE THAT BEGAN INSIDE A REFERENCE WAS WIDENED TO IT, since its first word character was a letter '
        + 'and the shown character before the whole reference is a letter',
      fn: async () => {
        expect([
          spanCuts({ text: 'See dogs&amp; cats now', quote: '&amp; cats', needle: 'amp; cats', },),
          spanCuts({ text: 'See Tom&amp; Jerry now', quote: '&amp; Jerry', needle: 'amp; Jerry', },),
          spanCuts({ text: 'Call AT&amp;T now', quote: '&amp;T now', needle: 'amp;T now', },),
        ],).toEqual([true, true, true,],);
      },
    },),
    it({
      name: 'CUTS NO WORD AT WHOLE WORDS: a plain word, a word with an ampersand inside, a span that ends in the reference of an '
        + 'ampersand beside a space, a span that ends before a no-break space, and words beside punctuation or Han text',
      fn: async () => {
        expect([
          spanCuts({ text: 'See kittens now', quote: 'kittens', },),
          spanCuts({ text: 'Call AT&amp;T now', quote: 'AT&amp;T', },),
          spanCuts({ text: 'See Tom &amp; Jerry now', quote: 'Tom &amp;', needle: 'Tom &', },),
          spanCuts({ text: 'See kittens&nbsp;more', quote: 'kittens', },),
          spanCuts({ text: 'See (kittens), now', quote: 'kittens', },),
          spanCuts({ text: '看kittens好', quote: 'kittens', },),
        ],).toEqual([false, false, false, false, false, false,],);
      },
    },),
    it({
      name: 'CUTS NO WORD AT AN EDGE THAT IS NO LATIN WORD EDGE OF THE QUOTE, so a quote that ends in punctuation or begins with a '
        + 'mark is not tested there',
      fn: async () => {
        expect([
          spanCuts({ text: 'See dogs&amp; now', quote: '&amp;', needle: '&', },),
          spanCuts({ text: 'See kittens,&#115; now', quote: 'kittens,', },),
        ],).toEqual([false, false,],);
      },
    },),
  ],
},);
