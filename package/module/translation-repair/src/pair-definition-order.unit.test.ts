/**
 * Tests for the seam between the block pairing and the footnote relabel:
 * definition blocks named as order-free, a crossing definition pair kept out
 * of the slicing and read by label.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  crossingFinding,
  definitionIndexes,
  definitionLabelsOf,
  parseDocument,
  splitDefinitionPairs,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Original: the sister is the first note, the substitute parent the second.
 */
const SOURCE = parseDocument({
  text: '## 生平\n\n洲洲[^2]收留了她，真理[^1]帮助她。\n\n[^1]: 比她小，像姐姐一样。\n\n[^2]: 干妈？像母女一样。\n',
},);

/**
 * Archive: renumbered by first appearance, so its definitions cross the
 * original's when paired by content.
 */
const TARGET = parseDocument({
  text: '## Life\n\nZhouzhou[^1] took her in.\n\nZhenli[^2] helped her.\n\n'
    + '[^1]: A substitute parent? Like mother and daughter.\n\n[^2]: Younger than her, like a sister.\n',
},);

//endregion Fixtures

await describe({
  name: definitionIndexes.name,
  children: [
    it({
      name: 'names the footnote definition blocks by their chunk-local index and nothing else',
      fn: async () => {
        expect([ ...definitionIndexes({ nodes: SOURCE.nodes, },), ],).toStrictEqual([
          2,
          3,
        ],);
        expect([ ...definitionIndexes({ nodes: TARGET.nodes, },), ],).toStrictEqual([
          3,
          4,
        ],);
      },
    },),
  ],
},);

await describe({
  name: definitionLabelsOf.name,
  children: [
    it({
      name: 'reads the label a definition opens with and nothing off a body block',
      fn: async () => {
        expect(SOURCE.nodes
          .map(function toLabels(node,): readonly string[] {
            return definitionLabelsOf({ node, },);
          },),).toStrictEqual([
          [],
          [],
          [ '1', ],
          [ '2', ],
        ],);
      },
    },),
  ],
},);

await describe({
  name: splitDefinitionPairs.name,
  children: [
    it({
      name: 'keeps crossing definition pairs out of the slicing and reads them by label for the relabel',
      fn: async () => {
        /**
         * The pairing six of eight voices gave on the third yuki launch: body
         * paired in order, definitions paired by content, crossing.
         */
        const split = splitDefinitionPairs({
          pairs: [
            {
              source: 0,
              target: 0,
            },
            {
              source: 1,
              target: 1,
            },
            {
              source: 1,
              target: 2,
            },
            {
              source: 2,
              target: 4,
            },
            {
              source: 3,
              target: 3,
            },
          ],
          sourceNodes: SOURCE.nodes,
          targetNodes: TARGET.nodes,
        },);
        expect(split.crossing,).toBe(true,);
        expect(split.forSlicing,).toStrictEqual([
          {
            source: 0,
            target: 0,
          },
          {
            source: 1,
            target: 1,
          },
          {
            source: 1,
            target: 2,
          },
        ],);
        expect(split.definitionPairs,).toStrictEqual([
          {
            sourceLabel: '1',
            targetLabel: '2',
          },
          {
            sourceLabel: '2',
            targetLabel: '1',
          },
        ],);
      },
    },),

    it({
      name: 'hands every pair to the slicing, definitions included, where the definitions pair in order',
      fn: async () => {
        /**
         * The same documents after the relabel and the reorder: definitions
         * pair in order.
         */
        const split = splitDefinitionPairs({
          pairs: [
            {
              source: 1,
              target: 1,
            },
            {
              source: 2,
              target: 3,
            },
            {
              source: 3,
              target: 4,
            },
          ],
          sourceNodes: SOURCE.nodes,
          targetNodes: TARGET.nodes,
        },);
        expect(split.crossing,).toBe(false,);
        expect(split.forSlicing
          .length,).toBe(3,);
        expect(split.definitionPairs
          .length,).toBe(2,);
        expect(crossingFinding({ pairIndex: 4, },),).toContain('section 4',);
      },
    },),
  ],
},);
