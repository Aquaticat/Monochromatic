/**
 Guards class one hundred fifty-six (shihai4h1, 2026-09-26): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), three words from a student's life join the
 rendering glossary. 初中 shipped as "junior middle school" where four of the
 five archive passages that render it write "junior high school"; 自考 as
 "self-taught exams", which names no examination in English; 压力话 as
 "pressured remarks". The glossary seeds the English each should take and
 refuses the calques.

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
 Original in which the cat's grades were poor in junior high.
 */
const JUNIOR_HIGH = '猫在初中时成绩不好。';

/**
 Original in which the cat passes the self-study examinations.
 */
const SELF_STUDY = '猫参加自考考上了大学。';

/**
 Original in which the cat is nagged at home.
 */
const NAGGED = '猫在家经常被说压力话。';

/**
 Terms class one hundred fifty-six seeds.
 */
const SEEDED_TERMS = [
  '初中',
  '自考',
  '压力话',
] as const;

/**
 Candidates the page's calques would ship, each with the original it renders.
 */
const REFUSED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: JUNIOR_HIGH, candidateText: 'The cat had poor grades in junior middle school.', },
  { sourceText: SELF_STUDY, candidateText: 'The cat took self-taught exams and got into university.', },
  { sourceText: NAGGED, candidateText: 'At home the cat was often subjected to pressured remarks.', },
];

/**
 Candidates carrying the English meaning, each with the original it renders.
 */
const ACCEPTED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: JUNIOR_HIGH, candidateText: 'The cat had poor grades in junior high school.', },
  { sourceText: SELF_STUDY, candidateText: 'The cat passed the self-study examinations and got into university.', },
  { sourceText: NAGGED, candidateText: 'At home the cat was constantly pressured and nagged.', },
];

await describe({
  name: 'words from a student\'s life the rendering glossary renders (class one hundred fifty-six)',
  children: [
    it({
      name: 'SEEDS 初中, 自考 and 压力话',
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
