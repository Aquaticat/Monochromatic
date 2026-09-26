/**
 Guards class one hundred sixty-seven (TianqiChen6665, 2026-09-26): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), the UNO line of a farewell joins the
 rendering glossary. 这次的 uno，真的加了很多呢 shipped as the archive's
 "the game of Uno, truly, we've added a lot", which says nothing in English:
 in UNO, 加 is stacking the +2 and +4 draw cards.

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
 Original in which the kittens' card game piled on the draw cards.
 */
const GAME = '小猫们玩的 uno，真的加了很多呢。';

/**
 Candidate the page's reading would ship.
 */
const REFUSED_CANDIDATE = 'The kittens\' game of UNO, truly, they added a lot.';

/**
 Candidate saying what the stacked cards mean.
 */
const ACCEPTED_CANDIDATE = 'In the kittens\' game of UNO, the draw cards really piled up.';

await describe({
  name: 'game slang the rendering glossary renders (class one hundred sixty-seven)',
  children: [
    it({
      name: 'SEEDS the UNO line with the draw cards first',
      fn: async () => {
        expect(RENDERING_GLOSSARY
          .filter(function isTerm(entry,): boolean {
            return entry.term === 'uno，真的加了很多';
          },)
          .map(function firstRendering(entry,): string {
            return entry.renderings[0] ?? '';
          },),).toEqual(['draw cards',],);
      },
    },),
    it({
      name: 'REFUSES "added a lot"',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: GAME,
          candidateText: REFUSED_CANDIDATE,
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'PASSES the draw cards piling up',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: GAME,
          candidateText: ACCEPTED_CANDIDATE,
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
