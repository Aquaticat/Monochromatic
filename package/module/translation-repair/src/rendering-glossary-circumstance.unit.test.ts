/**
 Guards class one hundred fifty-nine (aiyysk2, 2026-09-26): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), two terms join the rendering glossary.
 环境的问题 shipped as "the environment", which an English reader takes for
 nature and pollution where the speaker meant the place she lived; 工程机 as
 "engineering phone", which names nothing in English, where the phone world
 says "prototype" or "engineering sample". The glossary seeds the English
 each should take and refuses the calques.

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
 Original in which the cat minds its hunger more than where it lives.
 */
const SURROUNDINGS = '猫没怎么在乎环境的问题，只想吃鱼。';

/**
 Original in which the cat finds a prototype phone that will not boot.
 */
const PROTOTYPE = '猫捡到一台工程机，开不了机。';

/**
 Terms class one hundred fifty-nine seeds.
 */
const SEEDED_TERMS = [
  '环境的问题',
  '工程机',
] as const;

/**
 Candidates the page's calques would ship, each with the original it renders.
 */
const REFUSED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: SURROUNDINGS, candidateText: 'The cat did not care much about the environment; it only wanted fish.', },
  { sourceText: PROTOTYPE, candidateText: 'The cat found an engineering phone that would not boot.', },
];

/**
 Candidates carrying the English meaning, each with the original it renders.
 */
const ACCEPTED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: SURROUNDINGS, candidateText: 'The cat did not care much about its surroundings; it only wanted fish.', },
  { sourceText: PROTOTYPE, candidateText: 'The cat found a prototype phone that would not boot.', },
];

await describe({
  name: 'circumstance and hardware words the rendering glossary renders (class one hundred fifty-nine)',
  children: [
    it({
      name: 'SEEDS 环境的问题 and 工程机',
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
      name: 'PASSES the English meaning',
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
