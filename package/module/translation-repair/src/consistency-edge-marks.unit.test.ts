/**
 Tests for taking the marks and punctuation at the two edges of a quote off its
 words: which edge characters are not the words, which stay because they pair
 with one inside, and that the reading reaches a fixed point.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { edgeFreeWordsOf, } from '../dist/final/node/index.mjs';

/**
 The words left of a text once its edge characters are taken off.

 @param text - the quote, already in the fold

 @returns The words as one text

 @example
 ```ts
 const words = wordsLeftOf({ text: '"cat naps".', },); // 'cat naps'
 ```
 */
function wordsLeftOf({ text, }: { readonly text: string; },): string {
  return edgeFreeWordsOf({ points: Array.from(text,), },)
    .join('',);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: edgeFreeWordsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'TAKES SENTENCE PUNCTUATION AND SPACE OFF BOTH EDGES, and nothing inside',
          fn: async () => {
            expect([
              ' The cat, then naps?! ',
              '...',
              '',
            ].map(function leftOf(text,): string {
              return wordsLeftOf({ text, },);
            },),).toEqual(['The cat, then naps', '', '',],);
          },
        },),
        it({
          name: 'TAKES A MARK OFF THAT ENCLOSES ALL THE WORDS, one pair inside another included, once it is exposed',
          fn: async () => {
            expect([
              '"cat naps"',
              '(\'cat naps\')',
              '("cat naps").',
              '[(cat naps)]',
              '""',
            ].map(function leftOf(text,): string {
              return wordsLeftOf({ text, },);
            },),).toEqual(['cat naps', 'cat naps', 'cat naps', 'cat naps', '',],);
          },
        },),
        it({
          name: 'KEEPS A MARK AT AN EDGE THAT PAIRS WITH ONE INSIDE, a bracket or a quotation mark',
          fn: async () => {
            expect([
              '"cat," she said',
              'she said "cat"',
              '(cat) naps (here)',
              'cat naps (here)',
            ].map(function leftOf(text,): string {
              return wordsLeftOf({ text, },);
            },),).toEqual(['"cat," she said', 'she said "cat"', '(cat) naps (here)', 'cat naps (here)',],);
          },
        },),
        it({
          name: 'TAKES A MARK OFF AN EDGE THAT PAIRS WITH NOTHING, and a bracket that can only close or only open there',
          fn: async () => {
            expect([
              '"cat naps',
              'cat naps"',
              ')cat naps(',
              '(cat naps',
              'cat naps)',
            ].map(function leftOf(text,): string {
              return wordsLeftOf({ text, },);
            },),).toEqual(['cat naps', 'cat naps', 'cat naps', 'cat naps', 'cat naps',],);
          },
        },),
        it({
          name: 'KEEPS AN APOSTROPHE INSIDE A WORD OUT OF THE PAIRING, so a quote that opens beside one still closes',
          fn: async () => {
            expect([
              'wasn\'t kind',
              '\'wasn\'t kind\'',
              'the cats\' bowl',
            ].map(function leftOf(text,): string {
              return wordsLeftOf({ text, },);
            },),).toEqual(['wasn\'t kind', 'wasn\'t kind', 'the cats\' bowl',],);
          },
        },),
        it({
          name: 'KEEPS AN APOSTROPHE AT A WORD EDGE THAT NO MARK ACROSS THE QUOTE CLOSES OR OPENS, since it is part of the word '
            + 'it touches: a dropped initial, a dropped final letter and a plural possessive',
          fn: async () => {
            expect([
              '\'Tis the season',
              'we were goin\'',
              'the cats\'',
              'the bowl of the cats\'',
              '\'90s cats',
            ].map(function leftOf(text,): string {
              return wordsLeftOf({ text, },);
            },),).toEqual([
              '\'Tis the season',
              'we were goin\'',
              'the cats\'',
              'the bowl of the cats\'',
              '\'90s cats',
            ],);
          },
        },),
        it({
          name: 'TAKES THE PAIR OFF THAT ENCLOSES THE WHOLE QUOTE while an apostrophe inside it stays, and keeps a pair '
            + 'that closes inside the quote',
          fn: async () => {
            expect([
              '\'cats\' bowl\'',
              '\'the cats\' bowl is full\'',
              '\'hi\' there',
              'she said \'hi\'',
              '"He said \'hi\' to me"',
              '[a (b] c)',
            ].map(function leftOf(text,): string {
              return wordsLeftOf({ text, },);
            },),).toEqual([
              'cats\' bowl',
              'the cats\' bowl is full',
              '\'hi\' there',
              'she said \'hi\'',
              'He said \'hi\' to me',
              '[a (b] c)',
            ],);
          },
        },),
        it({
          name: 'TAKES A SINGLE QUOTATION MARK OFF AN EDGE THAT TOUCHES NO LETTER AND PAIRS WITH NOTHING, as before',
          fn: async () => {
            expect([
              '\' cat naps',
              'cat naps \'',
              '\'\'',
            ].map(function leftOf(text,): string {
              return wordsLeftOf({ text, },);
            },),).toEqual(['cat naps', 'cat naps', '',],);
          },
        },),
        it({
          name: 'LEAVES BRACKETS THAT DO NOT BALANCE IN ORDER where they are, since taking one off would strand another',
          fn: async () => {
            expect(wordsLeftOf({ text: '(cat (naps)', },),).toBe('(cat (naps)',);
          },
        },),
        it({
          name: 'READS ITS OWN RESULT AGAIN AS THE SAME WORDS when marks are exposed one beneath another',
          fn: async () => {
            const once = wordsLeftOf({ text: '(("cat naps")).', },);
            expect([once, wordsLeftOf({ text: once, },),],).toEqual(['cat naps', 'cat naps',],);
          },
        },),
      ],
    },),
  ],
},);
