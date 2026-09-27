/**
 Guards class one hundred thirty-one (shi_Yumiaoya32, 2026-09-25): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), words on the page join the rendering
 glossary. 辅导员 shipped as "her counselor" (a therapist to an English
 reader), 矫正机构 as "a correctional facility" (a prison), 营救计划 as "a
 rescue plan" and ICU 抢救了六天 as "six days of resuscitation in the ICU".

 The glossary audit of 2026-09-27 took out the class's entries keyed on one
 sentence's words (主动提出, 代替, 性格非常好) for the idiomatic English rule,
 seeded 抢救 as the word in place of ICU 抢救, and dropped 营救's refused
 forms, since a rescue operation is the English wherever the rescue is one
 (`glossary-dictionary-terms.unit.test.ts`).

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
 Original in which the cat's university advisor sends it away.
 */
const ADVISER = '猫的辅导员把它送去了别处。';

/**
 Original in which the cat is sent to a behaviour-correction centre.
 */
const CORRECTION = '猫被送入了矫正机构。';

/**
 Original in which the cats campaign to free their friend.
 */
const FREE = '猫们展开了营救计划。';

/**
 Original in which doctors fight for six days to save the cat.
 */
const INTENSIVE_CARE = '猫在 ICU 抢救了六天。';

/**
 Terms class one hundred thirty-one seeds, as the audit left them.
 */
const SEEDED_TERMS = [
  '辅导员',
  '矫正机构',
  '营救',
  '抢救',
] as const;

/**
 Candidates the page's calques would ship, each with the original it renders.
 */
const REFUSED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: ADVISER, candidateText: 'The cat\'s counselor sent it somewhere else.', },
  { sourceText: CORRECTION, candidateText: 'The cat was sent to a correctional facility.', },
];

/**
 Candidates carrying the English meaning, each with the original it renders.
 */
const ACCEPTED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: ADVISER, candidateText: 'The cat\'s student advisor sent it somewhere else.', },
  { sourceText: CORRECTION, candidateText: 'The cat was sent to a behaviour-correction centre.', },
  { sourceText: FREE, candidateText: 'The cats launched a campaign to free their friend.', },
  { sourceText: INTENSIVE_CARE, candidateText: 'Doctors fought for six days in the ICU to save the cat.', },
];

await describe({
  name: 'wording calques the rendering glossary refuses (class one hundred thirty-one)',
  children: [
    it({
      name: 'SEEDS 辅导员, 矫正机构, 营救 and 抢救',
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
