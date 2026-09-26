/**
 Guards class one hundred sixty (TianqiChen6662, 2026-09-26): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), three fandom words join the community
 glossary. 头壳, a kigurumi performer's head mask, shipped as "inside her
 head", the wearer's own head; 阿洛娜 and 亚托莉, the characters Arona of
 Blue Archive and Atri of ATRI -My Dear Moments-, shipped as the archive's
 "Alona and Atori", and no candidate on the run wrote the official names.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  COMMUNITY_GLOSSARY,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 Original in which the kitten performs in a kigurumi head.
 */
const HEAD = '小猫戴着头壳，在最狭小的空间里撑起了整个世界。';

/**
 Original in which the kitten dresses as the two characters.
 */
const CHARACTERS = '小猫扮成了阿洛娜和亚托莉。';

/**
 Terms class one hundred sixty seeds.
 */
const SEEDED_TERMS = [
  '头壳',
  '阿洛娜',
  '亚托莉',
] as const;

/**
 Candidates the page's misreadings would ship, each with the original it renders.
 */
const REFUSED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: HEAD, candidateText: 'Inside her head, the kitten held up a whole world in the smallest space.', },
  { sourceText: CHARACTERS, candidateText: 'The kitten dressed up as Alona and Atori.', },
];

/**
 Candidates carrying the community's words, each with the original it renders.
 */
const ACCEPTED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: HEAD, candidateText: 'Inside the headpiece, the kitten held up a whole world in the smallest space.', },
  { sourceText: CHARACTERS, candidateText: 'The kitten dressed up as Arona and Atri.', },
];

await describe({
  name: 'fandom words the community glossary renders (class one hundred sixty)',
  children: [
    it({
      name: 'SEEDS 头壳, 阿洛娜 and 亚托莉',
      fn: async () => {
        expect(SEEDED_TERMS.filter(function isSeeded(term,): boolean {
          return COMMUNITY_GLOSSARY.some(function isTerm(entry,): boolean {
            return entry.term === term;
          },);
        },),).toEqual([...SEEDED_TERMS,],);
      },
    },),
    it({
      name: 'REFUSES the head read as the wearer\'s and the archive\'s transliterated names',
      fn: async () => {
        expect(REFUSED_CANDIDATES.map(function kindOf(candidate,): string {
          return validateTranslatedSlice(candidate,).kind;
        },),).toEqual(REFUSED_CANDIDATES.map(function invalid(): string {
          return 'invalid';
        },),);
      },
    },),
    it({
      name: 'PASSES the headpiece and the official names',
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
