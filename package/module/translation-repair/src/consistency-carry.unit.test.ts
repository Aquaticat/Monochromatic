/**
 Tests for what a receiving place's carry decides without a model: which body
 block a span lies in, which candidate texts are distinct and in what order the
 sheet shows them, and what the choices among them come to.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import { createHash, } from 'node:crypto';

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  blockHolding,
  type ConsistencyChoiceVoice,
  carryChoiceOf,
  carryOffersOf,
  compareCodePoints,
} from '../dist/final/node/index.mjs';

/**
 Hex digest the candidate order is taken by.

 @param text - candidate text

 @returns Its sha256 digest in hex

 @example
 ```ts
 const digest = digestOf({ text: 'The cat naps.', },);
 ```
 */
function digestOf({ text, }: { readonly text: string; },): string {
  return createHash('sha256',).update(text, 'utf8',).digest('hex',);
}

/**
 Builds one heard choice.

 @param seat - seat that answered

 @param choice - label chosen

 @returns The choice with its seat

 @example
 ```ts
 const voice = voiceOf({ seat: 'a', choice: 'CANDIDATE 2', },);
 ```
 */
function voiceOf({ seat, choice, }: { readonly seat: string; readonly choice: string; },): ConsistencyChoiceVoice {
  return {
    seat,
    reason: 'It reads as the refrain reads.',
    choice,
  };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: blockHolding.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE BODY BLOCK THAT HOLDS A SPAN WHOLE, with its offsets and its text',
          fn: async () => {
            const english = 'The cat naps.\n\nThe fish swims in the bowl.';
            expect([
              blockHolding({ english, start: 4, end: 7, },),
              blockHolding({ english, start: 19, end: 30, },),
              blockHolding({ english, start: 0, end: 13, },),
            ],).toEqual([
              [{ start: 0, end: 13, text: 'The cat naps.', },],
              [{ start: 15, end: 42, text: 'The fish swims in the bowl.', },],
              [{ start: 0, end: 13, text: 'The cat naps.', },],
            ],);
          },
        },),
        it({
          name: 'NAMES THE INNERMOST PARAGRAPH, not the container, for a span inside a list item, a block quote or a nested '
            + 'quote and list, with offsets in the English whole',
          fn: async () => {
            const list = '- The cat naps in the sun.\n- The fish swims.\n';
            const afterIntro = 'Intro here.\n\n- The cat naps in the sun.\n- The fish swims.\n';
            const nested = '> - The cat naps in the sun.\n';
            const quote = '> The cat naps in the sun.\n> It is warm.\n';
            const secondInItem = '- The cat naps.\n\n  The fish swims in the bowl.\n';
            expect([
              blockHolding({ english: list, start: list.indexOf('cat naps',), end: list.indexOf('cat naps',) + 8, },),
              blockHolding({
                english: afterIntro,
                start: afterIntro.indexOf('cat naps',),
                end: afterIntro.indexOf('cat naps',) + 8,
              },),
              blockHolding({ english: nested, start: nested.indexOf('cat naps',), end: nested.indexOf('cat naps',) + 8, },),
              blockHolding({ english: quote, start: quote.indexOf('cat naps',), end: quote.indexOf('cat naps',) + 8, },),
              blockHolding({
                english: secondInItem,
                start: secondInItem.indexOf('fish swims',),
                end: secondInItem.indexOf('fish swims',) + 10,
              },),
            ],).toEqual([
              [{ start: 2, end: 26, text: 'The cat naps in the sun.', },],
              [{ start: 15, end: 39, text: 'The cat naps in the sun.', },],
              [{ start: 4, end: 28, text: 'The cat naps in the sun.', },],
              [{ start: 2, end: 40, text: 'The cat naps in the sun.\n> It is warm.', },],
              [{ start: 19, end: 46, text: 'The fish swims in the bowl.', },],
            ],);
          },
        },),
        it({
          name: 'NAMES THE PARAGRAPH ALONE, WITHOUT THE CLOSING TAG, for a span in the content of a details container, whatever '
            + 'stands before it',
          fn: async () => {
            const details = '<details>\n<summary>Cats</summary>\n\nThe cat naps in the sun.\n\n</details>\n';
            const afterIntro = `Intro here.\n\n${details}`;
            expect([
              blockHolding({ english: details, start: 40, end: 48, },),
              blockHolding({ english: afterIntro, start: 53, end: 61, },),
            ],).toEqual([
              [{ start: 35, end: 59, text: 'The cat naps in the sun.', },],
              [{ start: 48, end: 72, text: 'The cat naps in the sun.', },],
            ],);
          },
        },),
        it({
          name: 'KEEPS THE OFFSETS OF AN ENGLISH THAT STARTS WITH A BYTE ORDER MARK, A FRONT MATTER OR WINDOWS LINE ENDS, naming '
            + 'the same innermost paragraph',
          fn: async () => {
            const bom = `${String.fromCodePoint(0xFE_FF,)}- The cat naps in the sun.\n`;
            const front = '---\ntitle: Mittens\n---\n\n- The cat naps in the sun.\n';
            const windows = '- The cat naps in the sun.\r\n- The fish swims.\r\n';
            expect([
              blockHolding({ english: bom, start: 8, end: 16, },),
              blockHolding({ english: front, start: 29, end: 37, },),
              blockHolding({ english: windows, start: 6, end: 14, },),
            ],).toEqual([
              [{ start: 3, end: 27, text: 'The cat naps in the sun.', },],
              [{ start: 26, end: 50, text: 'The cat naps in the sun.', },],
              [{ start: 2, end: 26, text: 'The cat naps in the sun.', },],
            ],);
          },
        },),
        it({
          name: 'NAMES THE WHOLE TABLE FOR A SPAN IN A CELL, and the heading line for a span in a heading, since neither holds '
            + 'a paragraph',
          fn: async () => {
            const table = '| a | b |\n| - | - |\n| cat naps | x |\n';
            const heading = '## The cat naps\n\nThe fish swims.\n';
            expect([
              blockHolding({ english: table, start: 24, end: 32, },),
              blockHolding({ english: heading, start: 7, end: 15, },),
            ],).toEqual([
              [{ start: 0, end: 36, text: '| a | b |\n| - | - |\n| cat naps | x |', },],
              [{ start: 0, end: 15, text: '## The cat naps', },],
            ],);
          },
        },),
        it({
          name: 'NAMES NO BLOCK FOR A SPAN IN A FOOTNOTE DEFINITION, and the whole list for a span across two list items, '
            + 'since no paragraph holds it',
          fn: async () => {
            const footnote = 'The cat naps.[^1]\n\n[^1]: The note says the cat naps.\n';
            const items = '- The cat naps\n- in the sun.\n';
            expect([
              blockHolding({ english: footnote, start: 25, end: 35, },),
              blockHolding({ english: items, start: 11, end: 20, },),
            ],).toEqual([
              [],
              [{ start: 0, end: 28, text: '- The cat naps\n- in the sun.', },],
            ],);
          },
        },),
        it({
          name: 'NAMES NO BLOCK for a span that crosses two blocks, lies past the English, or lies in the front matter',
          fn: async () => {
            const english = 'The cat naps.\n\nThe fish swims.';
            const withFront = '---\ntitle: Mittens\n---\n\nThe cat naps.';
            expect([
              blockHolding({ english, start: 10, end: 20, },),
              blockHolding({ english, start: 20, end: 90, },),
              blockHolding({ english: withFront, start: 11, end: 18, },),
            ],).toEqual([[], [], [],],);
          },
        },),
      ],
    },),
    describe({
      name: carryOffersOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'OFFERS THE CURRENT TEXT ALONE when there is no splice and no writer, labelled CANDIDATE 1',
          fn: async () => {
            expect(carryOffersOf({ current: 'The cat naps.', splice: [], written: [], lineStructured: false, },),).toEqual([
              { label: 'CANDIDATE 1', kind: 'current', writers: [], text: 'The cat naps.', },
            ],);
          },
        },),
        it({
          name: 'LABELS THE DISTINCT TEXTS FROM ONE IN THE ORDER OF THEIR DIGESTS, the current text, the splice and each writer '
            + 'among them, whoever wrote them and whatever order they were given',
          fn: async () => {
            const current = 'The cat naps in the sun.';
            const splice = 'The kitten naps in the sun.';
            const written = [
              { seat: 'qwen', text: 'The kitten dozes in the sun.', },
              { seat: 'kimi', text: 'The kitten sleeps in the sun.', },
            ];
            const forward = carryOffersOf({ current, splice: [splice,], written, lineStructured: false, },);
            const backward = carryOffersOf({
              current,
              splice: [splice,],
              written: written.toReversed(),
              lineStructured: false,
            },);
            const byDigest = [current, splice, ...written.map(function textOf({ text, },): string {
              return text;
            },),].toSorted(function ascending(left, right,): number {
              return compareCodePoints({ left: digestOf({ text: left, },), right: digestOf({ text: right, },), },);
            },);
            expect({
              texts: forward.map(function textOf({ text, },): string {
                return text;
              },),
              labels: forward.map(function labelOf({ label, },): string {
                return label;
              },),
              kinds: forward.map(function kindOf({ text, kind, writers, },): string {
                return `${kind}:${writers.join('+',)}:${text}`;
              },).toSorted(),
              sameBackward: forward.map(function textOf({ text, },): string {
                return text;
              },).join('|',) === backward.map(function textOf({ text, },): string {
                return text;
              },).join('|',),
            },).toEqual({
              texts: byDigest,
              labels: ['CANDIDATE 1', 'CANDIDATE 2', 'CANDIDATE 3', 'CANDIDATE 4',],
              kinds: [
                'current::The cat naps in the sun.',
                'splice::The kitten naps in the sun.',
                'writer:kimi:The kitten sleeps in the sun.',
                'writer:qwen:The kitten dozes in the sun.',
              ].toSorted(),
              sameBackward: true,
            },);
          },
        },),
        it({
          name: 'JOINS TWO TEXTS THAT PUBLISH THE SAME PAGE into one candidate, which keeps the name of the current text, then '
            + 'the splice, then the first writer, and lists every seat that wrote it',
          fn: async () => {
            const offers = carryOffersOf({
              current: 'The cat naps in the sun.',
              splice: ['The kitten naps in the sun.',],
              written: [
                { seat: 'qwen', text: 'The cat naps\nin the sun.', },
                { seat: 'kimi', text: 'The kitten naps\nin the sun.', },
                { seat: 'glm', text: 'The kitten naps\nin the sun.', },
                { seat: 'mercury', text: 'The kitten dozes in the sun.', },
                { seat: 'minimax', text: 'The kitten dozes\nin the sun.', },
              ],
              lineStructured: false,
            },);
            expect(offers.map(function describeOffer({ kind, writers, text, },): string {
              return `${kind}:${writers.join('+',)}:${text}`;
            },).toSorted(),).toEqual([
              'current:qwen:The cat naps in the sun.',
              'splice:kimi+glm:The kitten naps in the sun.',
              'writer:mercury+minimax:The kitten dozes in the sun.',
            ].toSorted(),);
          },
        },),
        it({
          name: 'KEEPS A LINE BREAK AS A DIFFERENCE where the line-structure rule governs the slice, so two texts that differ '
            + 'only in their breaks are two candidates',
          fn: async () => {
            const offers = carryOffersOf({
              current: 'The cat naps.\nThe fish swims.',
              splice: [],
              written: [{ seat: 'qwen', text: 'The cat naps. The fish swims.', },],
              lineStructured: true,
            },);
            expect(offers.length,).toBe(2,);
          },
        },),
      ],
    },),
    describe({
      name: carryChoiceOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'CHOOSES THE CANDIDATE A STRICT MAJORITY OF THE USABLE CHOICES NAMED when they reach the quorum',
          fn: async () => {
            const decided = carryChoiceOf({
              voices: [
                voiceOf({ seat: 'a', choice: 'CANDIDATE 2', },),
                voiceOf({ seat: 'b', choice: 'CANDIDATE 2', },),
                voiceOf({ seat: 'c', choice: 'CANDIDATE 1', },),
              ],
              labels: ['CANDIDATE 1', 'CANDIDATE 2', 'CANDIDATE 3',],
              quorum: 2,
            },);
            expect(decided,).toEqual({ usable: 3, choice: { kind: 'chosen', label: 'CANDIDATE 2', }, },);
          },
        },),
        it({
          name: 'CHOOSES NOTHING BELOW THE QUORUM, and when nobody was heard, and names no majority for a tie',
          fn: async () => {
            const labels = ['CANDIDATE 1', 'CANDIDATE 2',];
            expect([
              carryChoiceOf({ voices: [voiceOf({ seat: 'a', choice: 'CANDIDATE 2', },),], labels, quorum: 2, },),
              carryChoiceOf({ voices: [], labels, quorum: 1, },),
              carryChoiceOf({
                voices: [voiceOf({ seat: 'a', choice: 'CANDIDATE 2', },), voiceOf({ seat: 'b', choice: 'CANDIDATE 1', },),],
                labels,
                quorum: 2,
              },),
            ],).toEqual([
              { usable: 1, choice: { kind: 'none', reason: 'no-quorum', }, },
              { usable: 0, choice: { kind: 'none', reason: 'no-quorum', }, },
              { usable: 2, choice: { kind: 'none', reason: 'no-majority', }, },
            ],);
          },
        },),
        it({
          name: 'DOES NOT COUNT A CHOICE OF A LABEL THE SHEET NEVER SHOWED or one with a blank reason',
          fn: async () => {
            const decided = carryChoiceOf({
              voices: [
                voiceOf({ seat: 'a', choice: 'CANDIDATE 9', },),
                { seat: 'b', reason: '', choice: 'CANDIDATE 2', },
                voiceOf({ seat: 'c', choice: 'CANDIDATE 1', },),
              ],
              labels: ['CANDIDATE 1', 'CANDIDATE 2',],
              quorum: 1,
            },);
            expect(decided,).toEqual({ usable: 1, choice: { kind: 'chosen', label: 'CANDIDATE 1', }, },);
          },
        },),
      ],
    },),
  ],
},);
