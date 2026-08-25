/**
 * Tests for the digit the damage lands on when the original ends in nine.
 *
 * WHY THIS SITS APART from `fidelity-alteration.unit.test.ts`: a GFP round that
 * needs to read one of these suites cannot afford the other aborting the file,
 * since `await describe` throws and the second suite would then never run.
 *
 * WHAT IT PINS. Variants walk the final digit forward and wrap THROUGH TEN, so
 * a year ending in nine offers zero first. Wrapping through nine instead skips
 * zero entirely and was measured on 2026-08-25 to fail no case, which left the
 * nearest variant of every such number untested.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { unsupportedVariant, } from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Archive English stating the year, and nothing near it.
 */
const CLEAN_TEXT = 'Mittens counted 2009 birds from the sill that winter.';

/**
 * Chinese original stating the same year.
 */
const SOURCE_TEXT = '2009 年冬天，小猫在窗台上数了很多鸟。';

//endregion Fixtures

await describe({
  name: unsupportedVariant.name,
  children: [
    it({
      name: 'CARRIES a final nine round to zero, offering the nearest neighbour of the stated year '
        + 'first, rather than skipping zero and damaging a year further from the original than it had to',
      fn: async () => {
        expect(unsupportedVariant({
          original: '2009',
          cleanText: CLEAN_TEXT,
          sourceText: SOURCE_TEXT,
        },),).toBe('2000',);
      },
    },),
    it({
      name: 'REFUSES a variant either side already states, since damage the original supports is not '
        + 'damage and would score the critics on a claim that is true',
      fn: async () => {
        expect(unsupportedVariant({
          original: '2009',
          cleanText: `${CLEAN_TEXT} She had counted 2000 the year before.`,
          sourceText: SOURCE_TEXT,
        },),).toBe('2001',);
      },
    },),
  ],
},);
