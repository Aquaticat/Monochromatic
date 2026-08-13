/**
 * Tests for invisible-line masking.
 *
 * The fixtures use the shape that OCCURS: a line holding only a byte-order
 * mark, with ordinary sentences directly above and below and no blank line
 * anywhere near it. An earlier attempt at this fix was written against a
 * hypothesis instead, a lone mark surrounded by blank lines, and it passed
 * while leaving the corpus case untouched.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  maskInvisibleLines,
  parseDocument,
} from '../dist/final/node/index.mjs';

/**
 * Byte-order mark, the character the corpus actually carries.
 */
const MARK = '\u{FEFF}';

await describe({
  name: maskInvisibleLines.name,
  children: [
    it({
      name: 'blanks a line holding only a byte-order mark, which is what lets '
        + 'the paragraph break return. Such a line is NOT blank to CommonMark, '
        + 'so it welds the paragraphs either side of it into one block: the '
        + 'corpus translation carrying three of them parses to 29 blocks '
        + 'welded and 32 masked, measured through parseDocument at the pin',
      fn: async () => {
        expect(maskInvisibleLines({ text: `Alpha.\n${MARK}\nBeta.\n`, },),)
          .toBe('Alpha.\n \nBeta.\n',);
      },
    },),

    it({
      name: 'preserves LENGTH exactly, because node text, quotes, hashes and '
        + 'every claim anchor are sliced from the body by absolute offset, so '
        + 'removing the character rather than replacing it would move every '
        + 'anchor after it',
      fn: async () => {
        /**
         * Body carrying two marked lines and one ordinary blank line.
         */
        const text = `Alpha.\n${MARK}\nBeta.\n\nGamma.\n${MARK}${MARK}\nDelta.\n`;

        expect(maskInvisibleLines({ text, },).length,).toBe(text.length,);
      },
    },),

    it({
      name: 'leaves an ordinary blank line untouched and keeps a line whose '
        + 'text merely CONTAINS a mark, since only a line that shows nothing '
        + 'yet is not blank does the welding',
      fn: async () => {
        expect(maskInvisibleLines({ text: 'Alpha.\n\nBeta.\n', },),)
          .toBe('Alpha.\n\nBeta.\n',);
        expect(maskInvisibleLines({ text: `Al${MARK}pha.\n`, },),)
          .toBe(`Al${MARK}pha.\n`,);
      },
    },),

    it({
      name: 'restores the block that the mark had welded, measured through the '
        + 'parser rather than the masker, because the masker returning the '
        + 'right string proves nothing about how CommonMark then reads it',
      fn: async () => {
        expect(parseDocument({ text: `Alpha.\n${MARK}\nBeta.\n`, },).nodes.length,)
          .toBe(parseDocument({ text: 'Alpha.\n\nBeta.\n', },).nodes.length,);
      },
    },),

    it({
      name: 'blanks a line of NON-ASCII space, which welds exactly as the mark '
        + 'does. CommonMark counts only U+0020 and U+0009 as blank, so a line '
        + 'holding one of these is a paragraph continuation however much it '
        + 'looks like whitespace',
      fn: async () => {
        for (const space of [
          '\u{00A0}',
          '\u{202F}',
          '\u{3000}',
          '\u{2007}',
          '\u{00AD}',
        ]) {
          expect(maskInvisibleLines({ text: `Alpha.\n${space}\nBeta.\n`, },),)
            .toBe('Alpha.\n \nBeta.\n',);
        }
      },
    },),

    it({
      name: 'catches those spaces despite every one of them being ECMAScript '
        + 'whitespace, which is the trap that broke the first draft of this '
        + 'file: any check phrased with trim() calls them empty and passes over '
        + 'the very characters it exists to catch',
      fn: async () => {
        for (const space of [
          '\u{00A0}',
          '\u{202F}',
          '\u{3000}',
        ])
          expect(space.trim(),).toBe('',);

        expect(parseDocument({ text: 'Alpha.\n\u{00A0}\nBeta.\n', },).nodes.length,)
          .toBe(parseDocument({ text: 'Alpha.\n\nBeta.\n', },).nodes.length,);
      },
    },),

    it({
      name: 'blanks a line mixing ordinary spaces with an invisible one, since '
        + 'the ordinary spaces alone would already have been blank and it is '
        + 'the invisible character that keeps the line from ending a paragraph',
      fn: async () => {
        expect(maskInvisibleLines({ text: `Alpha.\n  ${MARK} \nBeta.\n`, },),)
          .toBe('Alpha.\n    \nBeta.\n',);
      },
    },),
  ],
},);
