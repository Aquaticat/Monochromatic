/**
 Guards class one hundred twenty-six (shi_Yumiaoya27, 2026-09-25): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), five renderings on the page join the
 rendering glossary. 年级组长 shipped as "the grade leader", 未成年药娘 as "a
 minor trans girl" (read as "an unimportant trans girl"), 骨灰骰子 as "ash
 dice", 同居者 as "cohabitants" (a romantic partner, and plural for one
 housemate) and 精神霸凌 with its adjective dropped; the glossary seeds the
 English each should take and refuses the calques.

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
 Original in which the head of the cat's year comforts it.
 */
const YEAR_HEAD = '年级组长常常安慰这只猫。';

/**
 Original in which an underage trans girl torments the cat.
 */
const UNDERAGE = '这只猫被一位未成年药娘精神霸凌。';

/**
 Original in which the cat's ashes become dice.
 */
const ASHES = '这只猫的骨灰将制成骨灰骰子。';

/**
 Original in which the cat's housemate is taken away.
 */
const HOUSEMATE = '这只猫的同居者被带走了。';

/**
 Terms class one hundred twenty-six seeds.
 */
const SEEDED_TERMS = [
  '年级组长',
  '未成年',
  '骨灰骰子',
  '同居者',
  '精神霸凌',
] as const;

/**
 Candidates the page's calques would ship, each with the original it renders.
 */
const REFUSED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: YEAR_HEAD, candidateText: 'The grade leader often comforted the cat.', },
  { sourceText: UNDERAGE, candidateText: 'The cat was psychologically bullied by a minor trans girl.', },
  { sourceText: UNDERAGE, candidateText: 'The cat was spiritually bullied by an underage trans girl.', },
  { sourceText: ASHES, candidateText: 'The cat\'s ashes will be made into ash dice.', },
  { sourceText: HOUSEMATE, candidateText: 'The cat\'s cohabitant was taken away.', },
];

/**
 Candidates carrying the English meaning, each with the original it renders.
 */
const ACCEPTED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: YEAR_HEAD, candidateText: 'The grade coordinator often comforted the cat.', },
  { sourceText: UNDERAGE, candidateText: 'The cat was psychologically bullied by an underage trans girl.', },
  { sourceText: ASHES, candidateText: 'The cat\'s ashes will be made into dice.', },
  { sourceText: HOUSEMATE, candidateText: 'The cat\'s housemate was taken away.', },
];

await describe({
  name: 'school-life and memorial calques the rendering glossary refuses (class one hundred twenty-six)',
  children: [
    it({
      name: 'SEEDS 年级组长, 未成年, 骨灰骰子, 同居者 and 精神霸凌',
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
