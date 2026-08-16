/**
 * Tests for the size screen that says where a translation MOVED a passage
 * across a section boundary.
 *
 * What these pin is the positive control and the two nulls that make it
 * readable: a document whose slices expand evenly must flag nothing, a lone
 * unusual slice must not be called displacement, and a high slice beside a low
 * one must be.
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
  median,
  readDisplacement,
} from '../dist/final/node/index.mjs';

/**
 * Builds slice size readings from ratios, at a size the screen will read.
 *
 * @param ratios - translation characters per original character, per slice
 *
 * @returns Slice sizes carrying those ratios
 *
 * @example
 * ```ts
 * const slices = slicesAt({ ratios: [3, 3, 3,], },);
 * ```
 */
function slicesAt({ ratios, }: { readonly ratios: readonly number[]; },) {
  return ratios.map(function toSlice(ratio,) {
    return {
      sourceChars: 100,
      targetChars: Math.round(100 * ratio,),
    };
  },);
}

await describe({
  name: median.name,
  children: [
    it({
      name: 'takes the middle value, and answers zero for nothing rather than dividing by a count '
        + 'that is not there',
      fn: async () => {
        expect(median({ values: [
          9,
          1,
          5,
        ], },),).toBe(5,);
        expect(median({ values: [], },),).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: readDisplacement.name,
  children: [
    it({
      name: 'flags NOTHING when every slice expands at the translator own rate, which is the null '
        + 'this screen has to produce on an ordinary document',
      fn: async () => {
        const reading = readDisplacement({
          slices: slicesAt({ ratios: [
            3,
            3.2,
            2.9,
            3.4,
            3.1,
          ], },),
        },);
        expect(reading.median,).toBeGreaterThan(2.9,);
        expect(reading.highIndices,).toEqual([],);
        expect(reading.movedPairs,).toEqual([],);
      },
    },),
    it({
      name: 'POSITIVE CONTROL: a slice at three times the median beside one below it reads as a '
        + 'moved passage, which is the case the screen exists for',
      fn: async () => {
        /** Slice 1 took text on and slice 2 gave it up. */
        const reading = readDisplacement({
          slices: slicesAt({ ratios: [
            3,
            10,
            2,
            3.1,
            3,
          ], },),
        },);
        expect(reading.highIndices,).toEqual([1,],);
        expect(reading.movedPairs,).toEqual([{
          high: 1,
          low: 2,
        },],);
      },
    },),
    it({
      name: 'reports a high slice with NO below-median neighbour as high and not as moved, since a '
        + 'section that simply expanded is not a passage that went anywhere',
      fn: async () => {
        const reading = readDisplacement({
          slices: slicesAt({ ratios: [
            3.4,
            10,
            3.5,
            3,
            3.2,
          ], },),
        },);
        expect(reading.highIndices,).toEqual([1,],);
        expect(reading.movedPairs,).toEqual([],);
      },
    },),
    it({
      name: 'pairs a high slice with EITHER neighbour, since a passage can move forward or back',
      fn: async () => {
        const reading = readDisplacement({
          slices: slicesAt({ ratios: [
            2,
            10,
            3.2,
            3,
            3.1,
          ], },),
        },);
        expect(reading.movedPairs,).toEqual([{
          high: 1,
          low: 0,
        },],);
      },
    },),
    it({
      name: 'SKIPS a slice too short to read, so a two-word heading section cannot set the median '
        + 'or produce a ratio built on nothing',
      fn: async () => {
        const reading = readDisplacement({
          slices: [
            {
              sourceChars: 4,
              targetChars: 90,
            },
            {
              sourceChars: 100,
              targetChars: 300,
            },
            {
              sourceChars: 100,
              targetChars: 310,
            },
          ],
        },);
        expect(reading.ratios
          .length,).toBe(2,);
        expect(reading.highIndices,).toEqual([],);
      },
    },),
  ],
},);
