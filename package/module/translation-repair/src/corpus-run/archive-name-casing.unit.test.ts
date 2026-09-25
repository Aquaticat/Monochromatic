/**
 Guards class one hundred thirty-six (hulicaijia20, 2026-09-25): the archive
 writes a place's name title case every time it names it mid-sentence, in
 the body and again in a picture caption, and the bench wrote the same name
 with its later words in lower case on another line of the page, so the
 page carried one place under two casings. The archive's title-case form is
 restored where a shipped slice writes the name's first word as the archive
 does and a later word in another case. Cat-themed invention throughout; no
 corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  restoreArchiveNameCasing,
} from '../../dist/final/node/index.mjs';

/**
 One slice over an archive text.

 @param sliceIndex - where the slice stands

 @param target - archive text

 @returns Prepared pair

 @example
 ```ts
 const slice = pair({ sliceIndex: 0, target: 'She napped.', },);
 ```
 */
function pair(
  {
    sliceIndex,
    target,
  }: {
    readonly sliceIndex: number;
    readonly target: string;
  },
): ChunkPair {
  return {
    source: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: 4,
      text: '她打盹。',
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
 Archive slices: a street named mid-sentence twice, a phrase that only ever
 opens a sentence, a phrase the archive also writes in lower case, and a
 heading.
 */
const SLICES: readonly ChunkPair[] = [
  pair({
    sliceIndex: 0,
    target: 'We napped on the Maowu Fish Street[^1] at noon. Sunny Days were long.',
  },),
  pair({
    sliceIndex: 1,
    target: '<p style="text-align: center;">(The two of us near Maowu Fish Street)</p>',
  },),
  pair({
    sliceIndex: 2,
    target: 'Sunny Days never end. We liked the Yarn Hall and the yarn hall liked us, near Yarn Hall again.',
  },),
  pair({
    sliceIndex: 3,
    target: '## Along Maowu Fish Street',
  },),
];

/**
 Replacement texts of a pass's result, in order.

 @param rows - replacement rows

 @returns Their texts

 @example
 ```ts
 textsOf({ rows: [], },); // []
 ```
 */
function textsOf(
  { rows, }: { readonly rows: readonly { readonly replacementText: string; }[]; },
): readonly string[] {
  return rows.map(function textOf(row,): string {
    return row.replacementText;
  },);
}

await describe({
  name: 'restoreArchiveNameCasing (class one hundred thirty-six)',
  children: [
    it({
      name: 'RESTORES the archive\'s title-case form where the bench lowered a later word',
      fn: async () => {
        /**
         Pass over a page that wrote the street with a lower-case "fish street".
         */
        const restored = restoreArchiveNameCasing({
          slices: SLICES,
          replacements: [
            {
              sliceIndex: 0,
              replacementText: 'We napped on the Maowu fish street[^1] around noon.',
            },
          ],
        },);
        expect([
          textsOf({ rows: restored.replacements, },),
          restored.findings,
        ],).toEqual([
          ['We napped on the Maowu Fish Street[^1] around noon.',],
          ['archive-name-casing-restored (slice 0: "Maowu fish street" to "Maowu Fish Street")',],
        ],);
      },
    },),
    it({
      name: 'LEAVES a phrase the archive only writes at a sentence start, or also writes in lower case',
      fn: async () => {
        /**
         Pass over text writing both phrases in lower case mid-sentence.
         */
        const restored = restoreArchiveNameCasing({
          slices: SLICES,
          replacements: [
            {
              sliceIndex: 2,
              replacementText: 'The Sunny days never end, and the Yarn hall liked us.',
            },
          ],
        },);
        expect([
          textsOf({ rows: restored.replacements, },),
          restored.restored,
          restored.findings,
        ],).toEqual([
          ['The Sunny days never end, and the Yarn hall liked us.',],
          [],
          [],
        ],);
      },
    },),
    it({
      name: 'LEAVES a heading, a link destination, an attribute, and a first word written otherwise',
      fn: async () => {
        /**
         Pass over lines where the name stands outside prose or opens in lower case.
         */
        const restored = restoreArchiveNameCasing({
          slices: SLICES,
          replacements: [
            {
              sliceIndex: 3,
              replacementText: '## Along Maowu fish street',
            },
            {
              sliceIndex: 1,
              replacementText: '<Photo alt="Maowu fish street" /> [map](https://cats.example/Maowu fish street) maowu fish street',
            },
          ],
        },);
        expect([
          textsOf({ rows: restored.replacements, },),
          restored.findings,
        ],).toEqual([
          [
            '## Along Maowu fish street',
            '<Photo alt="Maowu fish street" /> [map](https://cats.example/Maowu fish street) maowu fish street',
          ],
          [],
        ],);
      },
    },),
  ],
},);
