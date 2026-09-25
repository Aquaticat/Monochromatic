/**
 Guards class one hundred thirty (shi_Yumiaoya31, 2026-09-25): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), nine more phrasings on the page join the
 rendering glossary. 三剑客汽车节目 shipped as "the Three Musketeers car show",
 燃油车 as "a fuel-powered car", 喘不过气 as "left her breathless", 密密麻麻的伤痕
 as "densely packed scars", 志愿填写 as "her application preferences", 命运的齿轮
 as "the gears of fate", 相关医院 as "the relevant hospitals", 巨大的影响 as "an
 enormous influence on her death" and 贴贴计划 as "her cuddling plan"; the
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
 Original in which the cat watches the trio's car shows.
 */
const TRIO = '猫也是三剑客汽车节目的忠实观众。';

/**
 Original likening the cat to a car that will be phased out.
 */
const GAS_CAR = '猫就如同燃油车一样，终究会消逝。';

/**
 Original in which schoolwork weighs on the cat.
 */
const CRUSHING = '学业压力使猫喘不过气来。';

/**
 Original in which the cat's paws are covered in scars.
 */
const SCARS = '猫的爪子上都是密密麻麻的伤痕。';

/**
 Original in which the cat's university applications go wrong.
 */
const APPLICATIONS = '猫的志愿填写出现巨大失误。';

/**
 Original in which fate turns for the cat.
 */
const FATE = '命运的齿轮就此转动。';

/**
 Original in which the cat seeks hospital treatment.
 */
const HOSPITAL = '猫积极去相关医院治疗。';

/**
 Original in which the cat's owners played a large part in its death.
 */
const LARGE_PART = '猫的主人对她的死也有着巨大的影响。';

/**
 Original in which the cat meets companions through cuddle meetups.
 */
const CUDDLES = '猫在她的贴贴计划中认识了许多同伴。';

/**
 Terms class one hundred thirty seeds.
 */
const SEEDED_TERMS = [
  '三剑客',
  '燃油车',
  '喘不过气',
  '密密麻麻',
  '志愿填写',
  '命运的齿轮',
  '相关医院',
  '巨大的影响',
  '贴贴计划',
] as const;

/**
 Candidates the page's calques would ship, each with the original it renders.
 */
const REFUSED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: TRIO, candidateText: 'The cat was also a devoted viewer of the Three Musketeers car show.', },
  { sourceText: GAS_CAR, candidateText: 'The cat was like a fuel-powered car, bound to fade away.', },
  { sourceText: CRUSHING, candidateText: 'The pressure of schoolwork left the cat breathless.', },
  { sourceText: SCARS, candidateText: 'The cat\'s paws were covered in densely packed scars.', },
  { sourceText: APPLICATIONS, candidateText: 'The cat made a major mistake in its application preferences.', },
  { sourceText: FATE, candidateText: 'And so the gears of fate began to turn.', },
  { sourceText: HOSPITAL, candidateText: 'The cat actively sought treatment at the relevant hospitals.', },
  { sourceText: LARGE_PART, candidateText: 'The cat\'s owners also had an enormous influence on her death.', },
  { sourceText: CUDDLES, candidateText: 'Through her cuddling plan the cat met many companions.', },
];

/**
 Candidates carrying the English meaning, each with the original it renders.
 */
const ACCEPTED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: TRIO, candidateText: 'The cat was also a devoted viewer of the Top Gear trio\'s car shows.', },
  { sourceText: GAS_CAR, candidateText: 'The cat was like a gas-powered car, bound to fade away.', },
  { sourceText: CRUSHING, candidateText: 'The pressure of schoolwork was crushing for the cat.', },
  { sourceText: SCARS, candidateText: 'The cat\'s paws were covered in scars.', },
  { sourceText: APPLICATIONS, candidateText: 'The cat made a serious mistake on its university applications.', },
  { sourceText: FATE, candidateText: 'And so the wheels of fate began to turn.', },
  { sourceText: HOSPITAL, candidateText: 'The cat actively sought hospital treatment.', },
  { sourceText: LARGE_PART, candidateText: 'The cat\'s owners also played a large part in her death.', },
  { sourceText: CUDDLES, candidateText: 'Through her cuddle meetups the cat met many companions.', },
];

await describe({
  name: 'idiom calques the rendering glossary refuses (class one hundred thirty)',
  children: [
    it({
      name: 'SEEDS 三剑客, 燃油车, 喘不过气, 密密麻麻, 志愿填写, 命运的齿轮, 相关医院, 巨大的影响 and 贴贴计划',
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
