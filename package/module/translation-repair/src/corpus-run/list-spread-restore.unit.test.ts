/**
 Guards class one hundred seventeen (CuspariaKLSY13, 2026-09-24): the
 original and the archive write a four-item list with a blank line between
 its items, and every consolidation proposal wrote it with none, so the page
 shipped a tight list where both references are loose. Loose or tight is
 how the list renders, not a wording any judge weighs, and no floor read
 it: the block shape names a list's kind and whether it is ordered, never
 its spacing. Where the page carries a list with the archive's item count
 and ordering in the archive's list's place, it takes the archive's
 spacing. Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  restoreListSpread,
} from '../../dist/final/node/index.mjs';
import { pair, } from './title-reference.test-fixture.ts';

/**
 A loose ordered list, a tight bulleted one, a paragraph, and a list the
 archive never carried.
 */
const SLICES: readonly ChunkPair[] = [
  pair({
    sliceIndex: 0,
    source: '1. 猫睡觉。\n\n2. 猫吃鱼。\n\n3. 猫叫。',
    target: '1. The cat sleeps.\n\n2. The cat eats fish.\n\n3. The cat meows.',
  },),
  pair({
    sliceIndex: 1,
    source: '- 爪子\n- 尾巴',
    target: '- Paws\n- Tail',
  },),
  pair({
    sliceIndex: 2,
    source: '猫在窗台上。',
    target: 'The cat is on the windowsill.',
  },),
  pair({
    sliceIndex: 3,
    source: '1. 猫\n\n2. 狗',
    target: '',
  },),
];

/**
 Replacement texts in order.

 @param rows - replacements after the pass

 @returns Their texts

 @example
 ```ts
 const texts = textsOf({ rows: restored.replacements, },);
 ```
 */
function textsOf({ rows, }: { readonly rows: readonly { readonly replacementText: string; }[]; },): readonly string[] {
  return rows.map(function textOf(row,): string {
    return row.replacementText;
  },);
}

await describe({
  name: 'a list keeps the archive\'s spacing between its items (class one hundred seventeen)',
  children: [
    it({
      name: 'LOOSENS a tight list the archive writes loose, and TIGHTENS a loose one the archive writes tight',
      fn: async () => {
        /**
         Pass over a page whose bench wrote the first list tight and the
         second loose.
         */
        const restored = restoreListSpread({
          slices: SLICES,
          replacements: [
            {
              sliceIndex: 0,
              replacementText: '1. The cat naps.\n2. The cat eats a fish.\n3. The cat mews.',
            },
            {
              sliceIndex: 1,
              replacementText: '- Paws\n\n- A tail',
            },
          ],
        },);
        expect(textsOf({ rows: restored.replacements, },),).toEqual([
          '1. The cat naps.\n\n2. The cat eats a fish.\n\n3. The cat mews.',
          '- Paws\n- A tail',
        ],);
        expect(restored.restored.length,).toBe(2,);
        expect(restored.findings.join('\n',),).toContain('list-spread-restored (slice 0:',);
        expect(restored.findings.join('\n',),).toContain('list-spread-restored (slice 1:',);
      },
    },),
    it({
      name: 'LEAVES a list whose item count differs, a spacing already equal, a slice with no archive list, and a slice the archive never carried',
      fn: async () => {
        /**
         Replacements none of which the archive's lists decide.
         */
        const replacements = [
          {
            sliceIndex: 0,
            replacementText: '1. The cat naps.\n2. The cat eats a fish.',
          },
          {
            sliceIndex: 1,
            replacementText: '- Paws\n- A tail',
          },
          {
            sliceIndex: 2,
            replacementText: '- The cat\n\n- The windowsill',
          },
          {
            sliceIndex: 3,
            replacementText: '1. Cat\n2. Dog',
          },
        ];
        /**
         Pass over them.
         */
        const restored = restoreListSpread({
          slices: SLICES,
          replacements,
        },);
        expect(restored.restored,).toEqual([],);
        expect(restored.findings,).toEqual([],);
        expect(textsOf({ rows: restored.replacements, },),).toEqual(textsOf({ rows: replacements, },),);
      },
    },),
    it({
      name: 'LEAVES a loose list whose items hold blank lines of their own where the archive writes it tight',
      fn: async () => {
        /**
         Pass over an item carrying two paragraphs, which no spacing between
         items can make tight.
         */
        const restored = restoreListSpread({
          slices: SLICES,
          replacements: [
            {
              sliceIndex: 1,
              replacementText: '- Paws\n\n  Soft ones.\n- A tail',
            },
          ],
        },);
        expect(restored.restored,).toEqual([],);
        expect(textsOf({ rows: restored.replacements, },),).toEqual(['- Paws\n\n  Soft ones.\n- A tail',],);
      },
    },),

    it({
      name: 'LEAVES A SINGLE-ITEM LIST ALONE, since a list of one carries no gap whose spacing could '
        + 'differ',
      fn: async () => {
        const restored = restoreListSpread({
          slices: [pair({ sliceIndex: 0, source: '- 猫', target: '- A cat.', },),],
          replacements: [{ sliceIndex: 0, replacementText: '- A cat.', },],
        },);
        expect(restored.restored,).toEqual([],);
        expect(textsOf({ rows: restored.replacements, },),).toEqual(['- A cat.',],);
      },
    },),

    it({
      name: 'LEAVES A SLICE WHOSE LIST COUNTS DIFFER between the text it replaces and the replacement, '
        + 'pairing them across that gap would respace the wrong list',
      fn: async () => {
        const restored = restoreListSpread({
          slices: [pair({
            sliceIndex: 0,
            source: '- 猫\n- 狗',
            target: '- A cat.\n- A dog.\n\nSome prose.\n\n- A bird.',
          },),],
          replacements: [{ sliceIndex: 0, replacementText: '- A cat.\n\n- A dog.', },],
        },);
        expect(restored.restored,).toEqual([],);
        expect(textsOf({ rows: restored.replacements, },),).toEqual(['- A cat.\n\n- A dog.',],);
      },
    },),
  ],
},);
