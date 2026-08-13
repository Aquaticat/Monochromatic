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
import {
  collapseLineBreaks,
  normalizePunctuation,
} from '../dist/final/node/index.mjs';

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

await describe({
  name: collapseLineBreaks.name,
  children: [
    it({
      name: 'reads a soft wrap as one space',
      fn: async () => {
        expect(collapseLineBreaks({ text: '小猫打盹，\n阳光很暖和。', },),).toBe(
          '小猫打盹， 阳光很暖和。',
        );
      },
    },),
    it({
      name: 'leaves a blank line as two spaces, so a joined quote still misses',
      fn: async () => {
        expect(collapseLineBreaks({ text: '第一段。\n\n第二段。', },),).toBe(
          '第一段。  第二段。',
        );
      },
    },),
    it({
      name: 'reads a carriage return as a space too',
      fn: async () => {
        expect(collapseLineBreaks({ text: '小猫打盹，\r\n阳光很暖和。', },),).toBe(
          '小猫打盹，  阳光很暖和。',
        );
      },
    },),
    it({
      name: 'preserves length so offsets transfer',
      fn: async () => {
        /**
         * Sample mixing wraps, a blank line, and punctuation left alone.
         */
        const mixed = '小猫打盹，\n阳光很暖和。\n\n老猫说：“喵。”\n';
        expect(collapseLineBreaks({ text: mixed, },),).toHaveLength(mixed.length,);
      },
    },),
    it({
      name: 'leaves punctuation variants alone, unlike normalizePunctuation',
      fn: async () => {
        expect(collapseLineBreaks({ text: '老猫说：“喵。”', },),).toBe('老猫说：“喵。”',);
      },
    },),
  ],
},);
