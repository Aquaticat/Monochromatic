/**
 * Tests for punctuation normalization:
 * every mapped variant collapses to its canonical character while
 * length is preserved unit for unit, so offsets found in normalized
 * text index the original exactly.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { normalizePunctuation, } from '../dist/final/node/index.mjs';

/**
 * Variant-to-canonical pairs the normalizer must collapse.
 */
const VARIANT_CASES = [
  ['‘', "'",],
  ['’', "'",],
  ['“', '"',],
  ['”', '"',],
  ['「', '"',],
  ['」', '"',],
  ['『', "'",],
  ['』', "'",],
  [' ', ' ',],
] as const;

await describe({
  name: normalizePunctuation.name,
  children: [
    ...VARIANT_CASES.map(function toCase([variant, canonical,],) {
      return it({
        name: `maps ${JSON.stringify(variant,)} onto ${JSON.stringify(canonical,)}`,
        fn: async () => {
          expect(normalizePunctuation({ text: variant, },),).toBe(canonical,);
        },
      },);
    },),
    it({
      name: 'leaves ASCII and CJK text unchanged',
      fn: async () => {
        expect(normalizePunctuation({ text: "the cat's 猫窝 [^1]", },),)
          .toBe("the cat's 猫窝 [^1]",);
      },
    },),
    it({
      name: 'preserves length over mixed text so offsets transfer',
      fn: async () => {
        /**
         * Mixed sample with every variant class plus surrounding prose.
         */
        const mixed = '老猫说：“打盹最舒服。”小猫写『喵』，又写「喵」，还写‘喵’和’喵‘。';
        expect(normalizePunctuation({ text: mixed, },),).toHaveLength(mixed.length,);
      },
    },),
  ],
},);
