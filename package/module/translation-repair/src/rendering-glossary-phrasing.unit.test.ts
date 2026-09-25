/**
 Guards class one hundred twenty-nine (shi_Yumiaoya30, 2026-09-25): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), five phrasings on the page join the
 rendering glossary. 原因是多方面的 shipped as "There were many sides to the
 cause", 这个特例 as "so this exception, Yumiao, received", 摆烂 as "turned to
 one of giving up", 陷入癫狂 as "pushed her mental state into madness" and
 万千世界 as "this myriad world"; the glossary seeds the English each should
 take and refuses the calques.

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
 Original naming the many causes of the cat's flight.
 */
const MANY_CAUSES = '猫出走的原因是多方面的。';

/**
 Original in which the cat, an exception, escapes a scolding.
 */
const EXCEPTION = '所以这只猫这个特例也没有受到批评。';

/**
 Original in which the cat stops trying to catch mice.
 */
const GAVE_UP = '猫对抓老鼠进入了摆烂状态。';

/**
 Original in which bad news drives the cat half mad.
 */
const FRENZY = '这导致猫的精神状态陷入癫狂。';

/**
 Original in which a camera keeps watching the world for the cat.
 */
const WIDE_WORLD = '那台相机将继续观察这万千世界。';

/**
 Terms class one hundred twenty-nine seeds.
 */
const SEEDED_TERMS = [
  '原因是多方面的',
  '特例',
  '摆烂',
  '陷入癫狂',
  '万千世界',
] as const;

/**
 Candidates the page's calques would ship, each with the original it renders.
 */
const REFUSED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: MANY_CAUSES, candidateText: 'There were many sides to the cause of the cat\'s flight.', },
  { sourceText: EXCEPTION, candidateText: 'So this exception, the cat, received no scolding.', },
  { sourceText: GAVE_UP, candidateText: 'The cat\'s attitude to mousing turned to one of giving up.', },
  { sourceText: GAVE_UP, candidateText: 'The cat slacked off on mousing.', },
  { sourceText: FRENZY, candidateText: 'This pushed the cat\'s mental state into madness.', },
  { sourceText: WIDE_WORLD, candidateText: 'That camera will go on watching this myriad world.', },
];

/**
 Candidates carrying the English meaning, each with the original it renders.
 */
const ACCEPTED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: MANY_CAUSES, candidateText: 'The cat\'s flight had many causes.', },
  { sourceText: EXCEPTION, candidateText: 'So the cat, as an exception, received no scolding.', },
  { sourceText: GAVE_UP, candidateText: 'The cat stopped trying to catch mice.', },
  { sourceText: FRENZY, candidateText: 'This drove the cat to the edge of madness.', },
  { sourceText: WIDE_WORLD, candidateText: 'That camera will go on watching this vast world.', },
];

await describe({
  name: 'phrasing calques the rendering glossary refuses (class one hundred twenty-nine)',
  children: [
    it({
      name: 'SEEDS 原因是多方面的, 特例, 摆烂, 陷入癫狂 and 万千世界',
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
