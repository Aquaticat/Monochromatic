/**
 * Tests for block construction, specifically that a block showing a reader
 * nothing never becomes a node.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { parseDocument, } from '../dist/final/node/index.mjs';

/**
 * Byte-order mark, the character that actually occurred in the corpus.
 */
const BYTE_ORDER_MARK = '\u{FEFF}';

await describe({
  name: 'buildDocumentNodes invisible blocks',
  children: [
    it({
      name: 'drops a paragraph holding only a byte-order mark, because Markdown '
        + 'reads that line as an ordinary block and a translation carrying one '
        + 'gains a paragraph its original lacks. Every later paragraph then '
        + 'pairs with the WRONG source paragraph, and the editor rewrites a '
        + 'correct sentence into a faithful translation of a different one, '
        + 'which no later stage can see because both texts are fluent',
      fn: async () => {
        /**
         * Same document with and without the invisible line between blocks.
         */
        const withMark = parseDocument({
          text: `Whiskers naps.\n\n${BYTE_ORDER_MARK}\n\nTabby purrs.\n`,
        },);

        /**
         * Counterpart carrying no invisible line at all.
         */
        const without = parseDocument({ text: 'Whiskers naps.\n\nTabby purrs.\n', },);

        expect(withMark.nodes.length,).toBe(without.nodes.length,);
        expect(withMark.nodes
          .map(function toText(node,) {
            return node.text;
          },),).toEqual(['Whiskers naps.', 'Tabby purrs.',],);
      },
    },),

    it({
      name: 'leaves every surviving node the id it had among the parser\'s '
        + 'children, so dropping an invisible block cannot renumber the blocks '
        + 'after it. Accepted issues anchor to `block/N`, so renumbering would '
        + 'point every claim recorded against an earlier parse somewhere else',
      fn: async () => {
        const parsed = parseDocument({
          text: `Whiskers naps.\n\n${BYTE_ORDER_MARK}\n\nTabby purrs.\n`,
        },);

        expect(parsed.nodes
          .map(function toId(node,) {
            return node.id;
          },),).toEqual(['block/0', 'block/2',],);
      },
    },),

    it({
      name: 'keeps a paragraph whose text merely CONTAINS an invisible '
        + 'character, since only a block showing nothing at all is absent and a '
        + 'stray mark inside a real sentence is still a real sentence',
      fn: async () => {
        const parsed = parseDocument({
          text: `Whiskers${BYTE_ORDER_MARK} naps.\n`,
        },);

        expect(parsed.nodes.length,).toBe(1,);
      },
    },),
  ],
},);
