/**
 * Tests for attaching archive transcript blocks to source-matched media.
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

import {
  claimMediaAdjacentTargets,
  type NumberedBlock,
} from '../dist/final/node/index.mjs';

/**
 * Literal site path placeholder, assembled so source does not resemble accidental interpolation.
 */
const PATH_TOKEN = [
  '$',
  '{path}',
].join('',);

/**
 * Shared media marker.
 */
const LETTER = `<PhotoScroll photos={[ '${PATH_TOKEN}/photos/letter.webp']} />`;

/**
 * Other media marker for ambiguous-gap fixture.
 */
const PORTRAIT = `<PhotoScroll photos={[ '${PATH_TOKEN}/photos/portrait.webp']} />`;

/**
 * Numbers text blocks in order.
 *
 * @param texts - block text in document order
 *
 * @returns Numbered blocks
 *
 * @example
 * ```ts
 * const blocks = numbered(['Cats nap.']);
 * ```
 */
function numbered(texts: readonly string[],): readonly NumberedBlock[] {
  return texts.map(function toBlock(text, index,) {
    return { index, text, };
  },);
}

await describe({
  name: claimMediaAdjacentTargets.name,
  children: [
    it({
      name: 'CLAIMS transcript run bounded by ordinary block and matching media marker so picture evidence reaches its quality slice',
      fn: async () => {
        expect(claimMediaAdjacentTargets({
          sourceBlocks: numbered([
            'About the cat.',
            LETTER,
            'Remember the cat.',
          ],),
          targetBlocks: numbered([
            'About the cat.',
            '<details>',
            'Translated letter.',
            LETTER,
            'Remember the cat.',
          ],),
          pairs: [
            { source: 0, target: 0, },
            { source: 1, target: 3, },
            { source: 2, target: 4, },
          ],
        },).pairs,).toEqual([
          { source: 0, target: 0, },
          { source: 1, target: 1, },
          { source: 1, target: 2, },
          { source: 1, target: 3, },
          { source: 2, target: 4, },
        ],);
      },
    },),
    it({
      name: 'LEAVES gap between distinct media markers unclaimed because adjacency cannot choose which picture supports it',
      fn: async () => {
        expect(claimMediaAdjacentTargets({
          sourceBlocks: numbered([
            LETTER,
            PORTRAIT,
          ],),
          targetBlocks: numbered([
            LETTER,
            'An ambiguous caption.',
            PORTRAIT,
          ],),
          pairs: [
            { source: 0, target: 0, },
            { source: 1, target: 2, },
          ],
        },).pairs,).toEqual([
          { source: 0, target: 0, },
          { source: 1, target: 2, },
        ],);
      },
    },),
    it({
      name: 'LEAVES ordinary unclaimed prose untouched when no paired blocks share media',
      fn: async () => {
        expect(claimMediaAdjacentTargets({
          sourceBlocks: numbered(['About the cat.',],),
          targetBlocks: numbered([
            'About the cat.',
            'An inherited aside.',
          ],),
          pairs: [{ source: 0, target: 0, },],
        },).findings,).toEqual([]);
      },
    },),
  ],
},);
