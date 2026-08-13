/**
 * Tests for the computed line-structure predicate.
 *
 * Its thresholds were chosen from a corpus measurement rather than by taste,
 * and they are measured on the SOURCE side. That is load-bearing: `Toka_ls`'s
 * Chinese verse has a median node length of 22 and the English rendering of the
 * same chunk has 99, so the same predicate reading the translation would never
 * fire. The original's shape is what a repair must preserve.
 *
 * The case that fixes the thresholds is real: `Toka_ls`'s verse has a median block
 * length of 22 while its prose chunks sit at 49 and 87. A threshold of 20 would
 * have missed the verse, which is why the boundary is tested here directly.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { isLineStructured, } from '../dist/final/node/index.mjs';

/**
 * Builds a slice from blocks.
 *
 * @param blocks - blank-line-separated blocks
 *
 * @returns Slice text
 *
 * @example
 * ```ts
 * const text = slice({ blocks: ['a', 'b',], },);
 * ```
 */
function slice(
  {
    blocks,
  }: {
    readonly blocks: readonly string[];
  },
): string {
  return blocks.join('\n\n',);
}

await describe({
  name: isLineStructured.name,
  children: [
    it({
      name: 'recognizes verse: many short blocks, each a unit rather than a '
        + 'paragraph, which is the shape whose editor rewrote three lines into '
        + 'invented ones',
      fn: async () => {
        expect(isLineStructured({
          text: slice({
            blocks: [
              '北斗狭长，化作流苏；',
              '溪流曲折，化作音符；',
              '无瑕的猫穿行其间；',
              '如梦中精灵，静静走过；',
              '然而阴影深处，黑暗潜伏。',
            ],
          },),
        },),).toBe(true,);
      },
    },),

    it({
      name: 'does NOT fire on prose, however many paragraphs it has, since a '
        + 'paragraph is not a unit the editor must preserve line for line',
      fn: async () => {
        expect(isLineStructured({
          text: slice({
            blocks: Array.from(
              { length: 8, },
              function paragraph(): string {
                return 'Mittens spent the whole afternoon on the windowsill, '
                  + 'watching the birds come and go and declining every '
                  + 'invitation to move somewhere less sunlit.';
              },
            ),
          },),
        },),).toBe(false,);
      },
    },),

    it({
      name: 'refuses to judge a slice under five blocks, because a stanza and a '
        + 'couple of short paragraphs are indistinguishable at that size',
      fn: async () => {
        expect(isLineStructured({
          text: slice({ blocks: ['One.', 'Two.', 'Three.', 'Four.',], },),
        },),).toBe(false,);
      },
    },),

    it({
      name: 'admits a median of 22, the measured value of the verse this exists '
        + 'for, and REFUSES a median of 31. A threshold of 20 would have missed '
        + 'the real case, so the boundary is pinned rather than left implicit',
      fn: async () => {
        /**
         * Five blocks of exactly 22 characters.
         */
        const atTwentyTwo = slice({
          blocks: Array.from(
            { length: 5, },
            function line(): string {
              return 'x'.repeat(22,);
            },
          ),
        },);

        /**
         * Five blocks of exactly 31 characters, one past the limit.
         */
        const atThirtyOne = slice({
          blocks: Array.from(
            { length: 5, },
            function line(): string {
              return 'x'.repeat(31,);
            },
          ),
        },);

        expect(isLineStructured({ text: atTwentyTwo, },),).toBe(true,);
        expect(isLineStructured({ text: atThirtyOne, },),).toBe(false,);
      },
    },),

    it({
      name: 'reads a chat transcript as line-structured too, which is correct '
        + 'rather than incidental: each message is a unit, so one output line '
        + 'per input line is the right instruction there as well',
      fn: async () => {
        expect(isLineStructured({
          text: slice({
            blocks: [
              '> Tried the new food today?',
              '> Not really my thing.',
              '> The sunny spot is better.',
              '> Agreed, entirely.',
              '> See you tomorrow!',
            ],
          },),
        },),).toBe(true,);
      },
    },),
  ],
},);
