/**
 Tests for moving a chosen place's quoted words over another place's by code:
 what a replacement is made of, which edges of a quote it adjusts, and how
 replacements in one slice meet each other.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  caught,
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  applyConsistencyEdits,
  type ConsistencyRendering,
  planConsistencyEdit,
} from '../dist/final/node/index.mjs';

/**
 A located rendering.

 @param core - the words the quote keeps

 @param start - offset in the English where the quote starts

 @param over - fields this case adds, a frame's slot among them

 @returns Located rendering

 @example
 ```ts
 const rendering = locatedAt({ core: 'the cat naps', start: 3, },);
 ```
 */
function locatedAt(
  {
    core,
    start,
    over = {},
  }: {
    readonly core: string;
    readonly start: number;
    readonly over?: Record<string, unknown>;
  },
): Extract<ConsistencyRendering, { readonly kind: 'located'; }> {
  return {
    kind: 'located',
    quote: core,
    core,
    start,
    ...over,
  } as Extract<ConsistencyRendering, { readonly kind: 'located'; }>;
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: planConsistencyEdit.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REPLACES THE RECEIVING PLACE\'S WORDS with the chosen words, over the span the receiving quote stands in',
          fn: async () => {
            expect(planConsistencyEdit({
              chosen: locatedAt({ core: 'the kitten dozes', start: 40, },),
              target: locatedAt({ core: 'the kitten naps', start: 7, },),
            },),).toEqual({
              kind: 'replace',
              start: 7,
              end: 22,
              text: 'the kitten dozes',
            },);
          },
        },),
        it({
          name: 'FINDS THE PLACE ALREADY AGREEING when the words are the same, and plans no edit',
          fn: async () => {
            expect(planConsistencyEdit({
              chosen: locatedAt({ core: 'the kitten dozes', start: 40, },),
              target: locatedAt({ core: 'the kitten dozes', start: 7, },),
            },),).toEqual({ kind: 'same', },);
          },
        },),
        it({
          name: 'LEAVES THE RECEIVING PLACE\'S CLOSING PUNCTUATION WHERE IT IS, replacing the core and not the quote',
          fn: async () => {
            expect(planConsistencyEdit({
              chosen: locatedAt({ core: 'the kitten dozes', start: 40, over: { quote: 'the kitten dozes.', }, },),
              target: locatedAt({ core: 'the kitten naps', start: 7, over: { quote: 'the kitten naps!', }, },),
            },),).toEqual({
              kind: 'replace',
              start: 7,
              end: 22,
              text: 'the kitten dozes',
            },);
          },
        },),
        it({
          name: 'GIVES THE FIRST LETTER THE RECEIVING PLACE\'S CASE when the two quotes begin with one letter, a '
            + 'sentence start into a clause and back',
          fn: async () => {
            expect([
              planConsistencyEdit({
                chosen: locatedAt({ core: 'The kitten dozes', start: 0, },),
                target: locatedAt({ core: 'the kitten naps', start: 9, },),
              },),
              planConsistencyEdit({
                chosen: locatedAt({ core: 'the kitten dozes', start: 9, },),
                target: locatedAt({ core: 'The kitten naps', start: 0, },),
              },),
            ],).toEqual([
              { kind: 'replace', start: 9, end: 24, text: 'the kitten dozes', },
              { kind: 'replace', start: 0, end: 15, text: 'The kitten dozes', },
            ],);
          },
        },),
        it({
          name: 'KEEPS THE CHOSEN CASE when the quotes begin with different letters, however they are capitalised',
          fn: async () => {
            expect(planConsistencyEdit({
              chosen: locatedAt({ core: 'Sunny windows nap', start: 0, },),
              target: locatedAt({ core: 'the kitten naps', start: 9, },),
            },),).toEqual({ kind: 'replace', start: 9, end: 24, text: 'Sunny windows nap', },);
          },
        },),
        it({
          name: 'GIVES A FRAME\'S RECEIVING PLACE THE CHOSEN PATTERN with its own slot words in the chosen slot',
          fn: async () => {
            expect(planConsistencyEdit({
              chosen: locatedAt({
                core: 'So this cat must be a chubby little treasure',
                start: 42,
                over: { slot: 'chubby', slotStart: 22, },
              },),
              target: locatedAt({
                core: 'So this cat is surely a lazy little treasure',
                start: 50,
                over: { slot: 'lazy', slotStart: 24, },
              },),
            },),).toEqual({
              kind: 'replace',
              start: 50,
              end: 94,
              text: 'So this cat must be a lazy little treasure',
            },);
          },
        },),
        it({
          name: 'GIVES A LETTER BEYOND THE FIRST PLANE THE RECEIVING PLACE\'S CASE, reading the whole character and not '
            + 'the first half of its pair',
          fn: async () => {
            const small = String.fromCodePoint(0x1_04_28,);
            const capital = String.fromCodePoint(0x1_04_00,);
            expect(planConsistencyEdit({
              chosen: locatedAt({ core: `${small} cat naps`, start: 0, },),
              target: locatedAt({ core: `${capital} cat sleeps`, start: 9, },),
            },),).toEqual({
              kind: 'replace',
              start: 9,
              end: 9 + `${capital} cat sleeps`.length,
              text: `${capital} cat naps`,
            },);
          },
        },),
        it({
          name: 'LEAVES A QUOTE THAT OPENS ON A DIGIT ALONE, each digit being its own',
          fn: async () => {
            expect(planConsistencyEdit({
              chosen: locatedAt({ core: '3 cats nap', start: 0, },),
              target: locatedAt({ core: '4 cats sleep', start: 9, },),
            },),).toEqual({ kind: 'replace', start: 9, end: 21, text: '3 cats nap', },);
          },
        },),
        it({
          name: 'GIVES THE FIRST LETTER AFTER AN OPENING MARK THE RECEIVING PLACE\'S CASE, a quotation mark or an emphasis '
            + 'mark opening both quotes',
          fn: async () => {
            expect([
              planConsistencyEdit({
                chosen: locatedAt({ core: '“The cat naps”', start: 0, },),
                target: locatedAt({ core: '“the cat naps”', start: 9, },),
              },),
              planConsistencyEdit({
                chosen: locatedAt({ core: '*The cat* naps', start: 0, },),
                target: locatedAt({ core: '*the cat* dozes', start: 9, },),
              },),
            ],).toEqual([
              { kind: 'same', },
              { kind: 'replace', start: 9, end: 24, text: '*the cat* naps', },
            ],);
          },
        },),
        it({
          name: 'LEAVES A QUOTE MADE OF OPENING MARKS ALONE AS IT IS, there being no letter to give a case',
          fn: async () => {
            expect([
              planConsistencyEdit({
                chosen: locatedAt({ core: '((', start: 0, },),
                target: locatedAt({ core: 'the cat', start: 9, },),
              },),
              planConsistencyEdit({
                chosen: locatedAt({ core: 'The cat', start: 0, },),
                target: locatedAt({ core: '**', start: 9, },),
              },),
            ],).toEqual([
              { kind: 'replace', start: 9, end: 16, text: '((', },
              { kind: 'replace', start: 9, end: 11, text: 'The cat', },
            ],);
          },
        },),
        it({
          name: 'REPLACES A RECEIVING QUOTE THAT BEGINS WITH THE CHOSEN QUOTE, and one at the start or the end of its English',
          fn: async () => {
            expect([
              planConsistencyEdit({
                chosen: locatedAt({ core: 'the kitten', start: 30, },),
                target: locatedAt({ core: 'the kitten naps on the mat', start: 0, },),
              },),
              planConsistencyEdit({
                chosen: locatedAt({ core: 'the kitten', start: 0, },),
                target: locatedAt({ core: 'the kitten naps', start: 17, },),
              },),
            ],).toEqual([
              { kind: 'replace', start: 0, end: 26, text: 'the kitten', },
              { kind: 'replace', start: 17, end: 32, text: 'the kitten', },
            ],);
          },
        },),
        it({
          name: 'FINDS A FRAME\'S PLACE ALREADY IN THE CHOSEN PATTERN when only its slot differs',
          fn: async () => {
            expect(planConsistencyEdit({
              chosen: locatedAt({
                core: 'So this cat must be a chubby little treasure',
                start: 42,
                over: { slot: 'chubby', slotStart: 22, },
              },),
              target: locatedAt({
                core: 'So this cat must be a lazy little treasure',
                start: 50,
                over: { slot: 'lazy', slotStart: 22, },
              },),
            },),).toEqual({ kind: 'same', },);
          },
        },),
      ],
    },),

    describe({
      name: applyConsistencyEdits.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'MAKES EVERY EDIT AGAINST THE ENGLISH IT WAS LOCATED IN, cutting the text once between the edits, so one edit '
            + 'moves no other',
          fn: async () => {
            const applied = applyConsistencyEdits({
              english: 'The kitten naps. The kitten dozes.',
              edits: [
                { id: 'first', start: 4, end: 10, text: 'cat', },
                { id: 'second', start: 21, end: 27, text: 'young cat', },
              ],
            },);
            expect(applied,).toEqual({
              text: 'The cat naps. The young cat dozes.',
              applied: ['first', 'second',],
              overlapped: [],
            },);
          },
        },),
        it({
          name: 'LEAVES OUT THE LATER OF TWO EDITS THAT OVERLAP, and reports it, the earlier edit winning',
          fn: async () => {
            const applied = applyConsistencyEdits({
              english: 'The kitten naps in the sun.',
              edits: [
                { id: 'earlier', start: 4, end: 15, text: 'cat sleeps', },
                { id: 'later', start: 11, end: 20, text: 'dozes in', },
              ],
            },);
            expect(applied,).toEqual({
              text: 'The cat sleeps in the sun.',
              applied: ['earlier',],
              overlapped: ['later',],
            },);
          },
        },),
        it({
          name: 'MAKES TWO EDITS THAT TOUCH WITHOUT OVERLAPPING, the span end being exclusive',
          fn: async () => {
            const applied = applyConsistencyEdits({
              english: 'abcdef',
              edits: [
                { id: 'left', start: 0, end: 3, text: 'XY', },
                { id: 'right', start: 3, end: 6, text: 'Z', },
              ],
            },);
            expect(applied,).toEqual({
              text: 'XYZ',
              applied: ['left', 'right',],
              overlapped: [],
            },);
          },
        },),
        it({
          name: 'CHANGES NOTHING for no edits',
          fn: async () => {
            expect(applyConsistencyEdits({ english: 'The cat naps.', edits: [], },),).toEqual({
              text: 'The cat naps.',
              applied: [],
              overlapped: [],
            },);
          },
        },),
        it({
          name: 'REFUSES AN EDIT WHOSE SPAN LIES OUTSIDE THE ENGLISH OR IS EMPTY, since offsets located in that English '
            + 'cannot',
          fn: async () => {
            /**
             Applies one edit to a short English and reports the refusal.
             */
            function refusalOf({ start, end, }: { readonly start: number; readonly end: number; },): string {
              return String(caught(function act(): unknown {
                return applyConsistencyEdits({
                  english: 'The cat.',
                  edits: [{ id: 'x', start, end, text: 'y', },],
                },);
              },),);
            }
            /**
             The refusal for a span.
             */
            function message({ spans, }: { readonly spans: string; },): string {
              return `ConsistencyInvariantError: unreachable: edit x spans ${spans} in an English whose length is 8, and a span `
                + 'located in that English lies inside it and is not empty';
            }
            expect([
              refusalOf({ start: -1, end: 2, },),
              refusalOf({ start: 3, end: 9, },),
              refusalOf({ start: 4, end: 4, },),
            ],).toEqual([
              message({ spans: '-1 to 2', },),
              message({ spans: '3 to 9', },),
              message({ spans: '4 to 4', },),
            ],);
          },
        },),
      ],
    },),
  ],
},);
