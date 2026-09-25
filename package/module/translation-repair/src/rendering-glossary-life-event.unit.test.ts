/**
 Guards class one hundred thirty-three (shi_Yumiaoya34, 2026-09-25): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), two more phrasings join the rendering
 glossary. 人生中的第一颗补佳乐 shipped as "the first Progynova of her life" and
 精神已留下了巨大的创伤 as "her mind had already been left with great trauma";
 the glossary seeds the English each should take and refuses the calques.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  RENDERING_GLOSSARY,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 Original in which the cat eats its very first piece of kibble.
 */
const FIRST_KIBBLE = '猫吃下了人生中的第一颗猫粮。';

/**
 Original in which a fright leaves the cat deeply traumatized.
 */
const TRAUMA = '猫的精神已留下了巨大的创伤。';

/**
 Terms class one hundred thirty-three seeds.
 */
const SEEDED_TERMS = ['人生中的第一颗', '留下了巨大的创伤',] as const;

/**
 Candidates the page's calques would ship, each with the original it renders.
 */
const REFUSED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: FIRST_KIBBLE, candidateText: 'The cat ate the first kibble of its life.', },
  { sourceText: TRAUMA, candidateText: 'The cat\'s mind had been left with great trauma.', },
];

/**
 Candidates carrying the English meaning, each with the original it renders.
 */
const ACCEPTED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: FIRST_KIBBLE, candidateText: 'The cat ate its very first piece of kibble.', },
  { sourceText: TRAUMA, candidateText: 'It had left the cat deeply traumatized.', },
];

await describe({
  name: 'life-event calques the rendering glossary refuses (class one hundred thirty-three)',
  children: [
    it({
      name: 'SEEDS 人生中的第一颗 and 留下了巨大的创伤',
      fn: async () => {
        expect(SEEDED_TERMS.filter(function isSeeded(term,): boolean {
          return RENDERING_GLOSSARY.some(function isTerm(entry,): boolean {
            return entry.term === term;
          },);
        },),).toEqual([...SEEDED_TERMS,],);
      },
    },),
    it({
      name: 'REFUSES the calques the page shipped',
      fn: async () => {
        expect(REFUSED_CANDIDATES.map(function kindOf(candidate,): string {
          return validateTranslatedSlice(candidate,).kind;
        },),).toEqual(REFUSED_CANDIDATES.map(function invalid(): string {
          return 'invalid';
        },),);
      },
    },),
    it({
      name: 'ACCEPTS the English meaning',
      fn: async () => {
        expect(ACCEPTED_CANDIDATES.map(function kindOf(candidate,): string {
          return validateTranslatedSlice(candidate,).kind;
        },),).toEqual(ACCEPTED_CANDIDATES.map(function valid(): string {
          return 'valid';
        },),);
      },
    },),
  ],
},);
