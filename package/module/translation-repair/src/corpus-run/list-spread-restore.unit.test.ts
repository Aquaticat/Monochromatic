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

/**
 One prepared pair.

 @param sliceIndex - where the slice stands

 @param source - original text

 @param target - archive text, empty where the archive never translated it

 @returns Prepared pair

 @example
 ```ts
 const slice = pair({ sliceIndex: 0, source: '1. 猫', target: '1. Cat', },);
 ```
 */
function pair(
  {
    sliceIndex,
    source,
    target,
  }: {
    readonly sliceIndex: number;
    readonly source: string;
    readonly target: string;
  },
): ChunkPair {
  return {
    source: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: source.length,
      text: source,
    },
    target: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: target.length,
      text: target,
    },
  };
}

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
  ],
},);
