/**
 Guards class one hundred sixty-one (TianqiChen6662, 2026-09-26): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), 化作 joins the rendering glossary; it
 shipped as the archive's "turned into in a small box", a slip no lane
 repaired.

 The class seeded seven more entries keyed on one sentence's grammar (被她治愈,
 应该会有更好的生活, 遇到的却是, 在隙中, 一切都会有机会, 离开我们的时候,
 所以她是个). The glossary audit of 2026-09-27 took them out for the general
 grammatical English rule on every sheet, which
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
 Original in which the kitten's fur becomes a small ball.
 */
const BECOMING = '小猫的毛化作一个小小的毛球。';

await describe({
  name: 'grammar slips the rendering glossary refuses (class one hundred sixty-one)',
  children: [
    it({
      name: 'SEEDS 化作',
      fn: async () => {
        expect(RENDERING_GLOSSARY.some(function isTerm(entry,): boolean {
          return entry.term === '化作';
        },),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES the slip the page shipped',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: BECOMING,
          candidateText: 'The kitten\'s fur turned into in a small ball.',
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'PASSES the grammatical English',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: BECOMING,
          candidateText: 'The kitten\'s fur turned into a small ball.',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
