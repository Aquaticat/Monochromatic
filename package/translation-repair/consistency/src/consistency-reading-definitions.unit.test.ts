/**
 Tests for the page definitions that change how the words of a place read: the reading of words under a set of definitions, the
 smallest set of the page's definitions that gives a span the slot and the reading the whole set gives (none where the page's
 definitions change neither), and the set two places are read with, which a reader of a record joins from the two places' own.

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
  type ConsistencyVoice,
  definitionsMovingReadingOf,
  foldedWordsOf,
  joinedDefinitionsOf,
  quotesByLabelOf,
  wordReadingOf,
} from '../dist/final/node/index.mjs';

/**
 The definition of a reference whose label ends in the character of emphasis, which makes the `*` inside it no delimiter.
 */
const DEFINITION = '[b*]: https://cats.example/b';

/**
 Words that end in a mark after closing emphasis: the closing `*` is a delimiter only where `[b*]` is a reference, so the mark
 is an apostrophe of the word with the definition and a loose mark without it.
 */
const WORDS = 'a [b*] c*’';

/**
 The definitions that move the reading of a span, when the ballots all gave the slot (if any) beside the span.

 @param span - the span of the first place, as its English holds it

 @param slot - the slot every ballot gave, none for a place of a run

 @param definitions - the definitions of the page

 @returns What `definitionsMovingReadingOf` gives

 @example
 ```ts
 const moving = movingFor({ span: WORDS, definitions: DEFINITION, },);
 ```
 */
function movingFor(
  {
    span,
    slot,
    definitions,
  }: {
    readonly span: string;
    readonly slot?: string;
    readonly definitions: string;
  },
): string {
  /**
   Three ballots that gave the span, and the slot beside it where the case has one.
   */
  const voices: readonly ConsistencyVoice[] = ['a', 'b', 'c',].map(function ballotFor(seat,): ConsistencyVoice {
    return {
      seat,
      reason: 'It words the first place best.',
      quotes: [
        {
          label: 'OCCURRENCE 1',
          quote: span,
          ...((slot === undefined) ? {} : { slot, }),
        },
      ],
      choice: 'OCCURRENCE 1',
      keep: [],
    };
  },);
  return definitionsMovingReadingOf({
    voices,
    label: 'OCCURRENCE 1',
    words: foldedWordsOf({ text: span, },),
    span,
    quotesByLabel: quotesByLabelOf({ voices, },),
    definitions,
    framed: slot !== undefined,
  },);
}

await describe({
  name: '',
  concurrency: DEFAULT_CONCURRENCY,
  children: [
    describe({
      name: wordReadingOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS WORDS ANOTHER WAY WITH A DEFINITION THAT MAKES A REFERENCE OF A BRACKET: the mark after `c*` is a loose mark '
            + 'alone and an apostrophe of its word with the definition, while words that hold no such bracket read alike either way',
          fn: async () => {
            expect([
              wordReadingOf({ text: WORDS, definitions: '', },) === wordReadingOf({ text: WORDS, definitions: DEFINITION, },),
              wordReadingOf({ text: 'the dogs’', definitions: '', },)
              === wordReadingOf({ text: 'the dogs’', definitions: DEFINITION, },),
            ],).toEqual([false, true,],);
          },
        },),
        it({
          name: 'READS THE SAME WORDS THE SAME WAY EVERY TIME, and tells words apart by what they hold: the reading is text that equals '
            + 'itself for equal words and differs for words whose loose marks stand in other places',
          fn: async () => {
            expect([
              wordReadingOf({ text: 'the dogs’', definitions: '', },) === wordReadingOf({ text: 'the dogs’', definitions: '', },),
              wordReadingOf({ text: '“the dogs”', definitions: '', },) === wordReadingOf({ text: 'the “dogs”', definitions: '', },),
              wordReadingOf({ text: 'the dogs’', definitions: '', },) === wordReadingOf({ text: 'the dogs', definitions: '', },),
            ],).toEqual([true, false, false,],);
          },
        },),
      ],
    },),
    describe({
      name: definitionsMovingReadingOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'GIVES NONE WHERE THE PAGE HAS NO DEFINITIONS OR THEY CHANGE NEITHER THE SLOT NOR THE READING: the definition of another '
            + 'reference leaves `a[b]c` with its slot and the words read alike, and a place of a run whose words hold no bracket needs none',
          fn: async () => {
            expect([
              movingFor({ span: 'a[b]c', slot: 'b', definitions: '', },),
              movingFor({ span: 'a[b]c', slot: 'b', definitions: '[z]: https://x.example/z', },),
              movingFor({ span: 'the cat naps', slot: 'naps', definitions: '[z]: https://x.example/z', },),
              movingFor({ span: 'the dogs’', definitions: DEFINITION, },),
            ],).toEqual(['', '', '', '',],);
          },
        },),
        it({
          name: 'GIVES THE DEFINITION THAT CHANGES HOW THE WORDS OF A PLACE READ, for a place of a run too: the one definition of the '
            + 'bracket the closing emphasis sits beside, and no more of the page\'s definitions than that',
          fn: async () => {
            expect([
              movingFor({ span: WORDS, definitions: DEFINITION, },),
              movingFor({
                span: WORDS,
                definitions: `[x]: https://x.example/x\n${DEFINITION}\n[z]: https://x.example/z\n[^1]: First.\n\n    Second.`,
              },),
            ],).toEqual([DEFINITION, DEFINITION,],);
          },
        },),
        it({
          name: 'GIVES THE DEFINITION OF THE REFERENCE THE SLOT SITS BESIDE, which makes `a[b]c` one word and the slot `b` no stand, '
            + 'and no more of the page\'s definitions than the slot needs, whole entries among them',
          fn: async () => {
            /**
             The definitions of a page: three references, and a footnote of two paragraphs after them.
             */
            const definitions = '[x]: https://x.example/x\n[b]: https://x.example/b\n[z]: https://x.example/z\n'
              + '[^1]: First paragraph.\n\n    Second paragraph.';
            expect([
              movingFor({ span: 'a[b]c', slot: 'b', definitions: '[b]: https://x.example/b', },),
              movingFor({ span: 'a[b]c', slot: 'b', definitions, },),
              movingFor({ span: 'a[b]c [d]e', slot: 'b', definitions: `[d]: https://x.example/d\n${definitions}`, },),
            ],).toEqual(['[b]: https://x.example/b', '[b]: https://x.example/b', '[b]: https://x.example/b',],);
          },
        },),
        it({
          name: 'GIVES ONE SET FOR A SLOT AND A READING THAT NEED DIFFERENT DEFINITIONS, so reading the slot with the set gives the slot '
            + 'the whole set gives and reading the words with it gives the reading the whole set gives',
          fn: async () => {
            /**
             Words with a bracket the slot sits beside and a mark whose reading needs the emphasis bracket.
             */
            const span = 'a[b]c [b*] d*’';
            expect(movingFor({
              span,
              slot: 'b',
              definitions: `[z]: https://x.example/z\n[b]: https://x.example/b\n${DEFINITION}`,
            },),).toBe(`[b]: https://x.example/b\n${DEFINITION}`,);
          },
        },),
      ],
    },),
    describe({
      name: joinedDefinitionsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'JOINS THE DEFINITIONS OF TWO PLACES INTO THE SET THEIR WORDS ARE READ WITH, each entry once, whole, the first place\'s '
            + 'first: a reader of a record holds only what the two places recorded',
          fn: async () => {
            expect([
              joinedDefinitionsOf({ chosen: undefined, target: undefined, },),
              joinedDefinitionsOf({ chosen: DEFINITION, target: undefined, },),
              joinedDefinitionsOf({ chosen: undefined, target: DEFINITION, },),
              joinedDefinitionsOf({ chosen: DEFINITION, target: DEFINITION, },),
              joinedDefinitionsOf({ chosen: '[a]: u', target: `[a]: u\n${DEFINITION}`, },),
              joinedDefinitionsOf({ chosen: '[^1]: First.\n\n    Second.', target: '[a]: u', },),
            ],).toEqual([
              '',
              DEFINITION,
              DEFINITION,
              DEFINITION,
              `[a]: u\n${DEFINITION}`,
              '[^1]: First.\n\n    Second.\n[a]: u',
            ],);
          },
        },),
      ],
    },),
  ],
},);
