/**
 Guards ledger A17: a signer's handle the ORIGINAL writes in Han and no
 declared or archive rendering covers is romanized with its literal meaning in
 parentheses (owner, 2026-09-22; the house policy's handle rule). Over the
 stored artifacts, 45 of the 51 such page signers shipped bare everywhere they
 were rendered, since no floor asked a writer for the gloss and the page passes
 cannot invent one; and a handle the archive also left in Han passed the Han
 residue floor, whose page excuse covers it. Cat-themed invention throughout;
 no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { validateTranslatedSlice, } from '../dist/final/node/index.mjs';

/**
 Original: a line and a signature whose signer writes in Han.
 */
const SOURCE_TEXT = '猫在窗台上睡觉。\n\n——橘猫，2021年';

/**
 Archive that left the signer in Han.
 */
const ARCHIVE_IN_HAN = 'The cat sleeps on the windowsill.\n\n——橘猫, 2021';

/**
 Findings a candidate draws against the original and a page, empty when it
 passes.

 @param candidateText - rendering under the floors

 @param pageText - page as it stands, the archive's own wording

 @param declared - name pairs the front matter declares

 @returns Findings of the composed verdict, empty for a valid candidate

 @example
 ```ts
 const findings = findingsFor({ candidateText: 'The cat sleeps.\n\n—— Jumao, 2021', },);
 ```
 */
function findingsFor(
  {
    candidateText,
    pageText = ARCHIVE_IN_HAN,
    declared = [],
  }: {
    readonly candidateText: string;
    readonly pageText?: string;
    readonly declared?: readonly { readonly source: string; readonly rendering: string; }[];
  },
): readonly string[] {
  /**
   Composed verdict.
   */
  const verdict = validateTranslatedSlice({
    sourceText: SOURCE_TEXT,
    candidateText,
    pageText,
    lineStructured: false,
    declared,
  },);
  return (verdict.kind === 'invalid') ? verdict.findings : [];
}

await describe({
  name: 'signer handle floor (ledger A17)',
  children: [
    it({
      name: 'REFUSES THE PINYIN READING WITH NO LITERAL MEANING, and names the reading to gloss',
      fn: async () => {
        /**
         Findings against the bare reading.
         */
        const findings = findingsFor({
          candidateText: 'The cat sleeps on the windowsill.\n\n—— Jumao, 2021',
        },).join(' ',);
        expect(findings,).toContain('Jumao',);
        expect(findings,).toContain('literal meaning',);
      },
    },),
    it({
      name: 'REFUSES A SPACED OR TONE-MARKED READING with no meaning the same way',
      fn: async () => {
        for (const rendering of [
          'Ju Mao',
          'Júmāo',
          'JUMAO',
        ]) {
          expect(findingsFor({
            candidateText: `The cat sleeps on the windowsill.\n\n—— ${rendering}, 2021`,
          },).join(' ',),).toContain('literal meaning',);
        }
      },
    },),
    it({
      name: 'REFUSES THE SIGNER LEFT IN HAN though the archive left it in Han too, which the Han residue '
        + 'floor excuses as Han the page already carries',
      fn: async () => {
        expect(findingsFor({
          candidateText: 'The cat sleeps on the windowsill.\n\n——橘猫, 2021',
        },).join(' ',),).toContain('Jumao',);
      },
    },),
    it({
      name: 'PASSES THE READING WITH ITS MEANING in parentheses',
      fn: async () => {
        expect(findingsFor({
          candidateText: 'The cat sleeps on the windowsill.\n\n—— Jumao (Orange Cat), 2021',
        },),).toEqual([],);
      },
    },),
    it({
      name: 'LEAVES A SIGNER THE ARCHIVE RENDERS IN LATIN LETTERS to the archive\'s authority, and one a '
        + 'declared pair renders to the declaration',
      fn: async () => {
        expect(findingsFor({
          candidateText: 'The cat sleeps on the windowsill.\n\n—— Marmalade, 2021',
          pageText: 'The cat sleeps on the windowsill.\n\n—— Marmalade, 2021',
        },),).toEqual([],);
        expect(findingsFor({
          candidateText: 'The cat sleeps on the windowsill.\n\n—— Marmalade, 2021',
          pageText: '',
          declared: [{ source: '橘猫', rendering: 'Marmalade', },],
        },),).toEqual([],);
      },
    },),
  ],
},);
