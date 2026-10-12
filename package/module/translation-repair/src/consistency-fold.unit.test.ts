/**
 Tests for reading a judge's quote in a place's own English: what the fold
 treats as one text, where a quote stands as the English holds it, and the
 cases it must not merge.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  foldedWordsOf,
  locateWords,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: foldedWordsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'TREATS A RUN OF WHITESPACE AS ONE SPACE, a line break and a tab included, and keeps a blank line apart '
            + 'from a space',
          fn: async () => {
            expect([
              foldedWordsOf({ text: 'The kitten   naps', },),
              foldedWordsOf({ text: 'The kitten\nnaps', },),
              foldedWordsOf({ text: 'The kitten\t naps', },),
              foldedWordsOf({ text: 'The kitten\n\nnaps', },),
              foldedWordsOf({ text: 'The kitten \n \n naps', },),
            ],).toEqual([
              'The kitten naps',
              'The kitten naps',
              'The kitten naps',
              'The kitten\nnaps',
              'The kitten\nnaps',
            ],);
          },
        },),
        it({
          name: 'TREATS STRAIGHT AND CURLY QUOTES AND APOSTROPHES AS EQUAL, by the evidence fold',
          fn: async () => {
            expect([
              foldedWordsOf({ text: 'The kitten wasn’t “asleep”', },),
              foldedWordsOf({ text: 'The kitten wasn\'t "asleep"', },),
            ],).toEqual([
              'The kitten wasn\'t "asleep"',
              'The kitten wasn\'t "asleep"',
            ],);
          },
        },),
        it({
          name: 'IGNORES SENTENCE PUNCTUATION, SPACE AND INVISIBLE CHARACTERS AT THE TWO EDGES of a quote, and nowhere else',
          fn: async () => {
            const invisible = String.fromCodePoint(0x20_0B,);
            expect([
              foldedWordsOf({ text: 'The kitten naps.', },),
              foldedWordsOf({ text: '  The kitten naps?!  ', },),
              foldedWordsOf({ text: `${invisible}The kitten naps${invisible}`, },),
              foldedWordsOf({ text: 'The kitten, then naps.', },),
              foldedWordsOf({ text: '...', },),
              foldedWordsOf({ text: '', },),
            ],).toEqual([
              'The kitten naps',
              'The kitten naps',
              'The kitten naps',
              'The kitten, then naps',
              '',
              '',
            ],);
          },
        },),
        it({
          name: 'DOES NOT MERGE WORDS THAT DIFFER, a letter case or a letter apart',
          fn: async () => {
            expect(new Set([
              foldedWordsOf({ text: 'The kitten naps', },),
              foldedWordsOf({ text: 'the kitten naps', },),
              foldedWordsOf({ text: 'The kittens naps', },),
            ],).size,).toBe(3,);
          },
        },),
      ],
    },),
    describe({
      name: locateWords.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'LOCATES A QUOTE THAT STANDS ONCE with the offsets of the English as it was given, a line break the quote '
            + 'writes as a space included',
          fn: async () => {
            const english = 'It purred.\nThe kitten wasn’t asleep,\nwas it?\nIt blinked.';
            const found = locateWords({ haystack: english, words: 'The kitten wasn\'t asleep, was it?', },);
            expect(found,).toEqual({ kind: 'once', start: 11, end: 43, },);
            expect(english.slice(11, 43,),).toBe('The kitten wasn’t asleep,\nwas it',);
          },
        },),
        it({
          name: 'LOCATES A QUOTE ACROSS A RUN OF SPACES IN THE ENGLISH, the end offset past the whole run it stands for',
          fn: async () => {
            const english = 'The kitten   naps  in the sun.';
            const found = locateWords({ haystack: english, words: 'The kitten naps in', },);
            expect(found,).toEqual({ kind: 'once', start: 0, end: 21, },);
            expect(english.slice(0, 21,),).toBe('The kitten   naps  in',);
          },
        },),
        it({
          name: 'FINDS NOTHING for a quote that stands nowhere, a quote that shows a reader nothing, and an empty English',
          fn: async () => {
            expect([
              locateWords({ haystack: 'The kitten naps.', words: 'The kitten dozes', },),
              locateWords({ haystack: 'The kitten naps.', words: '...', },),
              locateWords({ haystack: '', words: 'The kitten', },),
            ],).toEqual([{ kind: 'none', }, { kind: 'none', }, { kind: 'none', },],);
          },
        },),
        it({
          name: 'FINDS MANY for a quote that stands more than once, overlapping stands included',
          fn: async () => {
            expect([
              locateWords({ haystack: 'The cat naps. The cat naps.', words: 'The cat naps', },),
              locateWords({ haystack: 'aaa', words: 'aa', },),
            ],).toEqual([{ kind: 'many', }, { kind: 'many', },],);
          },
        },),
        it({
          name: 'KEEPS A BLANK LINE APART FROM A SPACE, so a quote across a paragraph boundary is found only when it holds one',
          fn: async () => {
            const english = 'The kitten naps.\n\nThe dog barks.';
            expect([
              locateWords({ haystack: english, words: 'kitten naps.\n\nThe dog', },),
              locateWords({ haystack: english, words: 'kitten naps. The dog', },),
            ],).toEqual([{ kind: 'once', start: 4, end: 25, }, { kind: 'none', },],);
          },
        },),
        it({
          name: 'LOCATES A QUOTE THAT HOLDS A CHARACTER BEYOND THE FIRST PLANE, offsets counted in the units the English is cut in',
          fn: async () => {
            const cat = String.fromCodePoint(0x1_F6_3A,);
            const english = `${cat} The kitten naps ${cat}.`;
            const found = locateWords({ haystack: english, words: `The kitten naps ${cat}`, },);
            expect(found,).toEqual({ kind: 'once', start: 3, end: english.length - 1, },);
          },
        },),
      ],
    },),
  ],
},);
