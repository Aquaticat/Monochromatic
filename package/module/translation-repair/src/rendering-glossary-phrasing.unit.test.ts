/**
 Guards class one hundred twenty-nine (shi_Yumiaoya30, 2026-09-25): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), 摆烂 (shipped as "turned to one of giving
 up") and 万千世界 (shipped as "this myriad world") join the rendering
 glossary.

 The class seeded three more entries keyed on one sentence's construction
 (原因是多方面的, 特例, 陷入癫狂). The glossary audit of 2026-09-27 took them out
 for the idiomatic English rule on every sheet, which
 `glossary-dictionary-terms.unit.test.ts` guards.

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
 Original in which the cat stops trying to catch mice.
 */
const GAVE_UP = '猫对抓老鼠进入了摆烂状态。';

/**
 Original in which a camera keeps watching the world for the cat.
 */
const WIDE_WORLD = '那台相机将继续观察这万千世界。';

/**
 Terms class one hundred twenty-nine seeds, as the audit left them.
 */
const SEEDED_TERMS = [
  '摆烂',
  '万千世界',
] as const;

/**
 Candidates the page's calques would ship, each with the original it renders.
 */
const REFUSED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: GAVE_UP, candidateText: 'The cat\'s attitude to mousing turned to one of giving up.', },
  { sourceText: GAVE_UP, candidateText: 'The cat slacked off on mousing.', },
  { sourceText: WIDE_WORLD, candidateText: 'That camera will go on watching this myriad world.', },
];

/**
 Candidates carrying the English meaning, each with the original it renders.
 */
const ACCEPTED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: GAVE_UP, candidateText: 'The cat stopped trying to catch mice.', },
  { sourceText: WIDE_WORLD, candidateText: 'That camera will go on watching this vast world.', },
];

await describe({
  name: 'phrasing calques the rendering glossary refuses (class one hundred twenty-nine)',
  children: [
    it({
      name: 'SEEDS 摆烂 and 万千世界',
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
