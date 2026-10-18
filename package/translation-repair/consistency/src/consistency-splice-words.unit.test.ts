/**
 Tests for reading the words of a place with the page definitions the place records: the counter records the definitions that
 change how the words of a place read, and the planner, the gain test and the locator read the words with them. Without the
 definitions a bracket such as `[b*]` is plain text and the closing emphasis after it pairs with an outer delimiter, so the mark
 that follows reads as a loose mark; with them it is an apostrophe of its word.

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
  bringsAtEdge,
  gainsBesideKeptMark,
  locateWords,
  planConsistencyEdit,
  withProvenApostrophes,
} from '../dist/final/node/index.mjs';
import {
  type Located,
  renderingsOf,
} from './consistency-renderings.test-fixture.ts';

/**
 The definition of a reference whose label ends in the character of emphasis.
 */
const DEFINITION = '[b*]: https://cats.example/b';

/**
 The receiving place's English: the words end in a mark after closing emphasis that pairs only where `[b*]` is a reference.
 */
const RECEIVING = 'Later *a [b*] c*’ naps.';

/**
 The chosen place's English: words that end in an apostrophe of a word whatever the page defines.
 */
const CHOSEN = 'Fill the dogs’ bowl.';

/**
 The two places counted on a page that defines the bracket in another slice, or on no page.

 @param page - whether the receiving place stands in a page that defines `[b*]`

 @returns The chosen and the receiving place's located renderings

 @example
 ```ts
 const [chosen, target,] = placesOn({ page: true, });
 ```
 */
function placesOn({ page, }: { readonly page: boolean; },): readonly [Located, Located] {
  return renderingsOf({
    chosen: { english: CHOSEN, quote: 'the dogs’', },
    receiving: {
      english: RECEIVING,
      quote: 'a [b*] c*’',
      ...(page ? { page: `${RECEIVING}\n\n${DEFINITION}`, } : {}),
    },
  },);
}

await describe({
  name: '',
  concurrency: DEFAULT_CONCURRENCY,
  children: [
    describe({
      name: 'counting a place',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'RECORDS THE DEFINITIONS THAT CHANGE HOW THE WORDS OF A PLACE READ, for a place of a run: the receiving place on a page '
            + 'that defines `[b*]` records that definition, and a place whose words read alike either way records none',
          fn: async () => {
            const [chosen, target,] = placesOn({ page: true, });
            const [, alone,] = placesOn({ page: false, });
            expect([chosen.definitions, target.definitions, alone.definitions,],).toEqual([undefined, DEFINITION, undefined,],);
          },
        },),
      ],
    },),
    describe({
      name: planConsistencyEdit.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS THE WORDS WITH THE DEFINITIONS THE PLACES RECORD WHEN ASKED TO: the mark after `c*` is an apostrophe of its word '
            + 'beside the chosen apostrophe, so the splice is a replacement that carries the definitions, where the words read alone make '
            + 'it a loose mark the chosen words lack and the splice is unavailable',
          fn: async () => {
            const [chosen, target,] = placesOn({ page: true, });
            expect([
              planConsistencyEdit({ chosen, target, framed: false, marks: 'compared', words: 'with-definitions', },),
              planConsistencyEdit({ chosen, target, framed: false, marks: 'compared', words: 'alone', },),
              planConsistencyEdit({ chosen, target, framed: false, marks: 'compared', },),
            ],).toEqual([
              { kind: 'replace', start: 7, end: 17, text: 'the dogs’', definitions: DEFINITION, },
              { kind: 'unavailable', },
              { kind: 'unavailable', },
            ],);
          },
        },),
        it({
          name: 'READS THE WORDS OF A PLACE WHOSE DEFINITIONS ARE MISSING FROM THE RECORD AS PLAIN TEXT, which is how a record that left '
            + 'them out is refused: the same two places with the recorded definitions removed are unavailable even when asked to read '
            + 'with them',
          fn: async () => {
            const [chosen, target,] = placesOn({ page: true, });
            const { definitions: _recorded, ...bare } = target;
            expect(planConsistencyEdit({ chosen, target: bare, framed: false, marks: 'compared', words: 'with-definitions', },),)
              .toEqual({ kind: 'unavailable', },);
          },
        },),
        it({
          name: 'PLANS WORDS THAT READ ALIKE EITHER WAY THE SAME WHICHEVER WAY THEY ARE READ, and a replacement of such words carries no '
            + 'definitions',
          fn: async () => {
            const [chosen, target,] = renderingsOf({
              chosen: { english: CHOSEN, quote: 'the dogs’', },
              receiving: { english: 'Then the family naps.', quote: 'the family', },
            },);
            expect([
              planConsistencyEdit({ chosen, target, framed: false, marks: 'compared', words: 'with-definitions', },),
              planConsistencyEdit({ chosen, target, framed: false, marks: 'compared', words: 'alone', },),
            ],).toEqual([
              { kind: 'replace', start: 5, end: 15, text: 'the dogs’', },
              { kind: 'replace', start: 5, end: 15, text: 'the dogs’', },
            ],);
          },
        },),
      ],
    },),
    describe({
      name: bringsAtEdge.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ASKS THE RECEIVING WORDS WITH THE DEFINITIONS IT IS GIVEN: the words that end in `c*’` hold an edge apostrophe with the '
            + 'definition, so an apostrophe arriving there is no gain, and hold none without it',
          fn: async () => {
            expect([
              bringsAtEdge({ text: 'the dogs’', core: 'a [b*] c*’', side: 'end', },),
              bringsAtEdge({ text: 'the dogs’', core: 'a [b*] c*’', side: 'end', definitions: DEFINITION, },),
            ],).toEqual([true, false,],);
          },
        },),
        it({
          name: 'ASKS THE GAIN BESIDE A KEPT MARK WITH THE SAME DEFINITIONS: a kept mark after the receiving words makes the arriving '
            + 'apostrophe a second mark only where the receiving words hold no edge apostrophe of their own',
          fn: async () => {
            const [chosen, target,] = placesOn({ page: true, });
            /**
             The receiving place with a single mark kept directly after its span.
             */
            const kept: Located = {
              ...target,
              markAfter: '\'',
            };
            expect([
              gainsBesideKeptMark({ text: chosen.core, target: kept, },),
              gainsBesideKeptMark({ text: chosen.core, target: kept, definitions: DEFINITION, },),
            ],).toEqual([true, false,],);
          },
        },),
      ],
    },),
    describe({
      name: 'the locator given definitions',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'PROVES AN APOSTROPHE WITH THE DEFINITIONS IT IS GIVEN: the mark after `c*` followed by `s` is a leading mark when `[b*]` '
            + 'is plain text and a joint of its word when it is a reference, so the span takes it in alone and leaves it out given them',
          fn: async () => {
            /**
             The English: the words `s bowl` begin right after the mark.
             */
            const haystack = '*a [b*] c*’s bowl';
            expect([
              withProvenApostrophes({ haystack, start: 11, end: 17, },),
              withProvenApostrophes({ haystack, start: 11, end: 17, definitions: DEFINITION, },),
            ],).toEqual([{ start: 10, end: 17, }, { start: 11, end: 17, },],);
          },
        },),
        it({
          name: 'HANDS THE DEFINITIONS IT IS GIVEN TO THE PROOF OF THE APOSTROPHE BESIDE THE WORDS it locates, not only to the word test: '
            + 'the span of `s bowl` in the English takes the mark in alone and leaves it out given the definitions',
          fn: async () => {
            expect([
              locateWords({ haystack: '*a [b*] c*’s bowl', words: 's bowl', },),
              locateWords({ haystack: '*a [b*] c*’s bowl', words: 's bowl', definitions: DEFINITION, },),
            ],).toEqual([{ kind: 'once', start: 10, end: 17, }, { kind: 'once', start: 11, end: 17, },],);
          },
        },),
      ],
    },),
  ],
},);
