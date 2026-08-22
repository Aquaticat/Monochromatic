/**
 * Tests for the absolute size predicates that decide which slices may set a
 * document's expansion baseline, and which evidence each one reports.
 *
 * WHY THE BOUNDARIES ARE TESTED FROM BOTH SIDES. Every endpoint here is a fixed
 * number that `#163` chose from a corpus reading, and the whole soundness
 * argument for excluding what they name is that they never consult the baseline.
 * A predicate that quietly moved by one character would keep passing a test that
 * only ever checked the middle of each band.
 *
 * Fixtures are invented counts, not corpus text.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  isPlausibleSlice,
  sliceImplausibility,
  sliceSizeOf,
} from '../dist/final/node/index.mjs';

await describe({
  name: sliceImplausibility.name,
  children: [
    it({
      name: 'STAYS SILENT on an ordinary slice, which is most of every document: the corpus '
        + 'expands about threefold and a slice sitting there is evidence of nothing',
      fn: async () => {
        expect(sliceImplausibility({
          slice: {
            sourceChars: 129,
            targetChars: 368,
            sourceBlocks: 2,
            targetBlocks: 2,
          },
        },),).toEqual([],);
      },
    },),

    it({
      name: 'RAISES target-far-shorter where the translation is shorter than the original, which '
        + 'cannot happen to a real Chinese-to-English rendering and means the content is '
        + 'somewhere else or nowhere',
      fn: async () => {
        expect(sliceImplausibility({
          slice: {
            sourceChars: 400,
            targetChars: 200,
            sourceBlocks: 1,
            targetBlocks: 1,
          },
        },),).toEqual(['target-far-shorter',],);
      },
    },),

    it({
      name: 'RAISES target-far-longer where the translation carries more than tenfold, which the '
        + 'original cannot account for and means content arrived from elsewhere',
      fn: async () => {
        expect(sliceImplausibility({
          slice: {
            sourceChars: 100,
            targetChars: 1_500,
            sourceBlocks: 1,
            targetBlocks: 1,
          },
        },),).toEqual(['target-far-longer',],);
      },
    },),

    it({
      name: 'RAISES block-count-gap on sizes that are otherwise unremarkable, since a pairing the '
        + 'two sides disagree about by more than one block makes the ratio a fact about the '
        + 'pairing rather than about the translation',
      fn: async () => {
        expect(sliceImplausibility({
          slice: {
            sourceChars: 200,
            targetChars: 600,
            sourceBlocks: 1,
            targetBlocks: 5,
          },
        },),).toEqual(['block-count-gap',],);
      },
    },),

    it({
      name: 'REPORTS EVERY REASON rather than the first, because the baseline wants only to know '
        + 'a slice is unclean while a judge is owed the whole evidence',
      fn: async () => {
        expect(sliceImplausibility({
          slice: {
            sourceChars: 100,
            targetChars: 2_000,
            sourceBlocks: 1,
            targetBlocks: 9,
          },
        },),).toEqual([
          'target-far-longer',
          'block-count-gap',
        ],);
      },
    },),

    it({
      name: 'STAYS SILENT ON AN EMPTY SIDE, both directions. A slice with no original has no '
        + 'ratio, and one with no translation is a section nobody rendered, which the '
        + 'displacement classifier already names: raising it here too would double-count it and '
        + 'call a missing section a rendering fault',
      fn: async () => {
        for (const slice of [
          {
            sourceChars: 0,
            targetChars: 900,
            sourceBlocks: 0,
            targetBlocks: 9,
          },
          {
            sourceChars: 900,
            targetChars: 0,
            sourceBlocks: 9,
            targetBlocks: 0,
          },
        ]) {
          expect(sliceImplausibility({ slice, },),).toEqual([],);
        }
      },
    },),

    it({
      name: 'HOLDS ITS ENDPOINTS EXACTLY: a ratio of 0.8, a ratio of 10 and a block gap of 1 are '
        + 'all inside, since each bound was picked from a corpus reading and a predicate that '
        + 'moved by one would keep passing a test that only checked the middle',
      fn: async () => {
        for (const slice of [
          {
            sourceChars: 500,
            targetChars: 400,
            sourceBlocks: 1,
            targetBlocks: 1,
          },
          {
            sourceChars: 100,
            targetChars: 1_000,
            sourceBlocks: 1,
            targetBlocks: 1,
          },
          {
            sourceChars: 200,
            targetChars: 600,
            sourceBlocks: 1,
            targetBlocks: 2,
          },
        ]) {
          expect(sliceImplausibility({ slice, },),).toEqual([],);
        }
      },
    },),

    it({
      name: 'RAISES ONE STEP PAST EACH ENDPOINT, which is the half of the boundary check that '
        + 'proves the bound is where it is claimed rather than merely somewhere further out',
      fn: async () => {
        expect(sliceImplausibility({
          slice: {
            sourceChars: 500,
            targetChars: 399,
            sourceBlocks: 1,
            targetBlocks: 1,
          },
        },),).toEqual(['target-far-shorter',],);
        expect(sliceImplausibility({
          slice: {
            sourceChars: 100,
            targetChars: 1_001,
            sourceBlocks: 1,
            targetBlocks: 1,
          },
        },),).toEqual(['target-far-longer',],);
        expect(sliceImplausibility({
          slice: {
            sourceChars: 200,
            targetChars: 600,
            sourceBlocks: 1,
            targetBlocks: 3,
          },
        },),).toEqual(['block-count-gap',],);
      },
    },),

    it({
      name: 'COUNTS A BLOCK GAP IN EITHER DIRECTION, since the pairing can leave the surplus on '
        + 'the original side just as easily as on the translated one',
      fn: async () => {
        expect(sliceImplausibility({
          slice: {
            sourceChars: 200,
            targetChars: 600,
            sourceBlocks: 5,
            targetBlocks: 1,
          },
        },),).toEqual(['block-count-gap',],);
      },
    },),
  ],
},);

await describe({
  name: isPlausibleSlice.name,
  children: [
    it({
      name: 'ACCEPTS a slice raising nothing and REFUSES one raising anything, which is the whole '
        + 'question the baseline asks: it needs to know a slice is clean, not why it is not',
      fn: async () => {
        expect(isPlausibleSlice({
          slice: {
            sourceChars: 129,
            targetChars: 368,
            sourceBlocks: 2,
            targetBlocks: 2,
          },
        },),).toBe(true,);
        expect(isPlausibleSlice({
          slice: {
            sourceChars: 200,
            targetChars: 600,
            sourceBlocks: 1,
            targetBlocks: 5,
          },
        },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: sliceSizeOf.name,
  children: [
    it({
      name: 'COUNTS CHARACTERS RAW AND BLOCKS BY BLANK LINES, which is the one place blocks are '
        + 'counted: two callers splitting them differently would run two estimators while '
        + 'reporting one number',
      fn: async () => {
        expect(sliceSizeOf({
          sourceText: 'first\n\nsecond',
          targetText: 'one\n\ntwo\n\nthree',
        },),).toEqual({
          sourceChars: 13,
          targetChars: 15,
          sourceBlocks: 2,
          targetBlocks: 3,
        },);
      },
    },),

    it({
      name: 'IGNORES A TRAILING SEPARATOR and any run of blank lines, because a formatting '
        + 'artifact at the end of a slice is not a block the pairing failed to match, and '
        + 'counting it would raise a gap on a pair that agrees',
      fn: async () => {
        const size = sliceSizeOf({
          sourceText: 'first\n\nsecond\n\n',
          targetText: 'one\n\n\n\ntwo',
        },);
        expect(size.sourceBlocks,).toBe(2,);
        expect(size.targetBlocks,).toBe(2,);
      },
    },),

    it({
      name: 'READS AN EMPTY SIDE AS ZERO BLOCKS rather than as one empty block, so a section '
        + 'nobody rendered does not arrive at the predicates carrying a block to compare',
      fn: async () => {
        const size = sliceSizeOf({
          sourceText: 'only this side',
          targetText: '',
        },);
        expect(size.targetChars,).toBe(0,);
        expect(size.targetBlocks,).toBe(0,);
      },
    },),
  ],
},);
