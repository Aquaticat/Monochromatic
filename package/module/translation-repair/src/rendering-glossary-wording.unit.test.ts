/**
 Guards class one hundred thirty-one (shi_Yumiaoya32, 2026-09-25): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), seven more phrasings on the page join the
 rendering glossary. 辅导员 shipped as "her counselor" (a therapist to an
 English reader), 矫正机构 as "a correctional facility" (a prison), 主动提出 as
 "took the initiative to propose", 营救计划 as "a rescue plan", ICU 抢救了六天
 as "six days of resuscitation in the ICU", 代替鱼喵的视角 as "replace Yumiao's
 perspective" and 性格非常好的人 as "a person of such a good nature"; the
 glossary seeds the English each should take and refuses the calques.

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
 Original in which the cat's university adviser sends it away.
 */
const ADVISER = '猫的辅导员把它送去了别处。';

/**
 Original in which the cat is sent to a behaviour-correction centre.
 */
const CORRECTION = '猫被送入了矫正机构。';

/**
 Original in which the cat is the one who suggests breaking up.
 */
const BREAKUP = '猫主动提出了分手。';

/**
 Original in which the cats campaign to free their friend.
 */
const FREE = '猫们展开了营救计划。';

/**
 Original in which doctors fight for six days to save the cat.
 */
const INTENSIVE_CARE = '猫在 ICU 抢救了六天。';

/**
 Original in which a camera looks on the world in the cat's place.
 */
const IN_HER_PLACE = '那台相机将代替她的视角，继续观察世界。';

/**
 Original calling the cat very good-natured.
 */
const NATURE = '猫是个性格非常好的猫。';

/**
 Terms class one hundred thirty-one seeds.
 */
const SEEDED_TERMS = [
  '辅导员',
  '矫正机构',
  '主动提出',
  '营救',
  'ICU 抢救',
  '代替',
  '性格非常好',
] as const;

/**
 Candidates the page's calques would ship, each with the original it renders.
 */
const REFUSED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: ADVISER, candidateText: 'The cat\'s counselor sent it somewhere else.', },
  { sourceText: CORRECTION, candidateText: 'The cat was sent to a correctional facility.', },
  { sourceText: BREAKUP, candidateText: 'The cat took the initiative to propose breaking up.', },
  { sourceText: FREE, candidateText: 'The cats launched a rescue plan.', },
  { sourceText: INTENSIVE_CARE, candidateText: 'The cat went through six days of resuscitation in the ICU.', },
  { sourceText: IN_HER_PLACE, candidateText: 'That camera will replace her perspective and keep watching the world.', },
  { sourceText: NATURE, candidateText: 'The cat was a cat of such a good nature.', },
];

/**
 Candidates carrying the English meaning, each with the original it renders.
 */
const ACCEPTED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: ADVISER, candidateText: 'The cat\'s student adviser sent it somewhere else.', },
  { sourceText: CORRECTION, candidateText: 'The cat was sent to a behaviour-correction centre.', },
  { sourceText: BREAKUP, candidateText: 'The cat was the one who suggested breaking up.', },
  { sourceText: FREE, candidateText: 'The cats launched a campaign to free their friend.', },
  { sourceText: INTENSIVE_CARE, candidateText: 'Doctors fought for six days in the ICU to save the cat.', },
  { sourceText: IN_HER_PLACE, candidateText: 'That camera will keep watching the world in her place.', },
  { sourceText: NATURE, candidateText: 'The cat was very good-natured.', },
];

await describe({
  name: 'wording calques the rendering glossary refuses (class one hundred thirty-one)',
  children: [
    it({
      name: 'SEEDS 辅导员, 矫正机构, 主动提出, 营救, ICU 抢救, 代替 and 性格非常好',
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
