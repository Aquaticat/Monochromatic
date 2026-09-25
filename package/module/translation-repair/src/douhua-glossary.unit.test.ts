/**
 Guards class one hundred thirty-five (hulicaijia20, 2026-09-25): 豆花 is
 seeded as "douhua", since the page's front matter, the archive and every
 other slice wrote "douhua" while the closing quote shipped "tofu pudding",
 one food under two names on one page.

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
 Original in which the cat is likened to douhua.
 */
const LIKE_DOUHUA = '在我看来，猫就像豆花一样吧。';

await describe({
  name: '豆花 on the sheets (class one hundred thirty-five)',
  children: [
    it({
      name: 'SEEDS 豆花',
      fn: async () => {
        expect(RENDERING_GLOSSARY.some(function isTerm(entry,): boolean {
          return entry.term === '豆花';
        },),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES tofu pudding and ACCEPTS douhua',
      fn: async () => {
        expect([
          validateTranslatedSlice({
            sourceText: LIKE_DOUHUA,
            candidateText: 'To me, the cat was something like tofu pudding.',
          },).kind,
          validateTranslatedSlice({
            sourceText: LIKE_DOUHUA,
            candidateText: 'To me, the cat was something like douhua.',
          },).kind,
        ],).toEqual(['invalid', 'valid',],);
      },
    },),
  ],
},);
