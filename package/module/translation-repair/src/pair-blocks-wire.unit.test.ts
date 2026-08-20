/**
 * Tests for block pairing: what the sheet carries, and what the reader refuses.
 *
 * WHY REFUSAL MATTERS MORE THAN ACCEPTANCE HERE. A wrong pairing puts two
 * passages that were never about the same thing in front of the critics, which
 * then report differences between them and are right to. `#71` recorded that a
 * wrong pairing is worse than no pairing for exactly this reason, so every
 * malformed reply below must throw rather than be tidied into something usable.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  BlockPairingError,
  buildBlockPairingMessages,
  isBlockPairingWire,
  readBlockPairing,
} from '../dist/final/node/index.mjs';

/**
 * Three blocks standing in for an original side.
 */
const SOURCE = [
  {
    index: 0,
    text: '猫睡了。',
  },
  {
    index: 1,
    text: '牠喜欢盒子。',
  },
  {
    index: 2,
    text: '牠不喜欢水。',
  },
];

/**
 * Four blocks standing in for a translation that split one paragraph.
 */
const TARGET = [
  {
    index: 0,
    text: 'The cat slept.',
  },
  {
    index: 1,
    text: 'She loves boxes.',
  },
  {
    index: 2,
    text: 'Cardboard ones especially.',
  },
  {
    index: 3,
    text: 'She does not love water.',
  },
];

await describe({
  name: buildBlockPairingMessages.name,
  children: [
    it({
      name: 'NUMBERS both sides so a reply can name them',
      fn: async () => {
        const messages = buildBlockPairingMessages({
          sourceBlocks: SOURCE,
          targetBlocks: TARGET,
        },);
        const sheet = String(messages[1]?.content,);
        expect(sheet,).toContain('ORIGINAL BLOCKS',);
        expect(sheet,).toContain('TRANSLATION BLOCKS',);
        expect(sheet,).toContain('[2]',);
        expect(sheet,).toContain('[3]',);
      },
    },),
    it({
      name: 'TELLS the model that leaving a block out is a correct answer',
      fn: async () => {
        const messages = buildBlockPairingMessages({
          sourceBlocks: SOURCE,
          targetBlocks: TARGET,
        },);
        expect(String(messages[0]?.content,),).toContain('LEAVE IT OUT',);
      },
    },),
    it({
      name: 'CHOOSES a fence no block can close, since blocks are arbitrary prose',
      fn: async () => {
        /**
         * A block carrying a fence run of the kind the sheet itself uses.
         */
        const awkward = 'A block whose own line reads ===== and continues.';
        const messages = buildBlockPairingMessages({
          sourceBlocks: [
            {
              index: 0,
              text: awkward,
            },
          ],
          targetBlocks: TARGET,
        },);

        /**
         * Delimiter the sheet chose.
         *
         * The sheet reads header, blank, `[0]`, fence, so the fence is the
         * fourth line. Reading the second returns the blank line, and
         * `includes('')` is true of everything, which is a test that cannot fail.
         */
        const fence = String(messages[1]?.content,)
          .split('\n',)
          .at(3,);
        expect(fence,).toBeDefined();

        /**
         * Whether the enclosed text could close the sheet's own delimiter.
         */
        const closable = awkward.includes(String(fence,),);
        // THE INVARIANT, not the character: whatever it picked, the enclosed
        // text must not be able to close it.
        expect(closable,).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: readBlockPairing.name,
  children: [
    it({
      name: 'ACCEPTS a monotone pairing that leaves a block unpaired',
      fn: async () => {
        const pairs = readBlockPairing({
          value: {
            pairs: [
              {
                source: 0,
                target: 0,
              },
              {
                source: 2,
                target: 3,
              },
            ],
          },
          sourceCount: 3,
          targetCount: 4,
        },);
        expect(pairs.length,).toBe(2,);
      },
    },),
    it({
      name: 'ACCEPTS one original rendered by TWO translation blocks',
      fn: async () => {
        const pairs = readBlockPairing({
          value: {
            pairs: [
              {
                source: 1,
                target: 1,
              },
              {
                source: 1,
                target: 2,
              },
            ],
          },
          sourceCount: 3,
          targetCount: 4,
        },);
        expect(pairs.length,).toBe(2,);
      },
    },),
    it({
      name: 'REFUSES a pairing that moves backwards on the original side',
      fn: async () => {
        expect(function readsBackwards() {
          readBlockPairing({
            value: {
              pairs: [
                {
                  source: 2,
                  target: 0,
                },
                {
                  source: 1,
                  target: 1,
                },
              ],
            },
            sourceCount: 3,
            targetCount: 4,
          },);
        },).toThrow(BlockPairingError,);
      },
    },),
    it({
      name: 'ACCEPTS one translation block rendering TWO originals, which is a merge',
      fn: async () => {
        // AN EARLIER VERSION REFUSED THIS, holding that a passage renders one
        // place. A live run refuted it: on `lintong` all six models
        // independently paired one translation block with two originals, every
        // reply was refused, and the entry fell back to scoring and collapsed
        // to a single slice. A translation may merge two paragraphs exactly as
        // it may split one.
        const pairs = readBlockPairing({
          value: {
            pairs: [
              {
                source: 0,
                target: 1,
              },
              {
                source: 1,
                target: 1,
              },
            ],
          },
          sourceCount: 3,
          targetCount: 4,
        },);
        expect(pairs.length,).toBe(2,);
      },
    },),
    it({
      name: 'REFUSES the same correspondence twice, which describes nothing new',
      fn: async () => {
        expect(function readsRepeat() {
          readBlockPairing({
            value: {
              pairs: [
                {
                  source: 1,
                  target: 1,
                },
                {
                  source: 1,
                  target: 1,
                },
              ],
            },
            sourceCount: 3,
            targetCount: 4,
          },);
        },).toThrow(BlockPairingError,);
      },
    },),
    it({
      name: 'REFUSES an index no block carries',
      fn: async () => {
        expect(function readsOutOfRange() {
          readBlockPairing({
            value: {
              pairs: [
                {
                  source: 9,
                  target: 0,
                },
              ],
            },
            sourceCount: 3,
            targetCount: 4,
          },);
        },).toThrow(BlockPairingError,);
      },
    },),
    it({
      name: 'REFUSES a reply that is not a pairing at all',
      fn: async () => {
        expect(function readsRubbish() {
          readBlockPairing({
            value: { pairs: 'all of them', },
            sourceCount: 3,
            targetCount: 4,
          },);
        },).toThrow(BlockPairingError,);
      },
    },),
    it({
      name: 'ACCEPTS an empty pairing, which says nothing corresponds',
      fn: async () => {
        expect(
          readBlockPairing({
            value: { pairs: [], },
            sourceCount: 3,
            targetCount: 4,
          },).length,
        ).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: isBlockPairingWire.name,
  children: [
    it({
      name: 'REFUSES non-integer indices, which cannot name a block',
      fn: async () => {
        expect(isBlockPairingWire({
          pairs: [
            {
              source: 0.5,
              target: 1,
            },
          ],
        },),).toBe(false,);
      },
    },),
  ],
},);
