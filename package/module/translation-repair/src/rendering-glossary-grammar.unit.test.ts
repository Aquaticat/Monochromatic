/**
 Guards class one hundred sixty-one (2026-09-26): under the owner's standing
 instruction of 2026-09-25 ("whenever you see anything that can be translated
 better do it"), 化作 joins the rendering glossary; one page shipped it as the
 archive's doubled preposition ("turned into in"), a slip no lane repaired.

 The class seeded seven more entries keyed on one sentence's grammar. The
 glossary audit of 2026-09-27 took them out for the general grammatical
 English rule on every sheet, which `glossary-dictionary-terms.unit.test.ts`
 guards, and which names them.

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
 Original in which a snowflake on the windowsill becomes a droplet.
 */
const BECOMING = '雪花落在窗台上，化作一滴小小的水珠。';

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
          candidateText: 'The snowflake landed on the windowsill and turned into in a tiny droplet.',
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'PASSES the grammatical English',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: BECOMING,
          candidateText: 'The snowflake landed on the windowsill and turned into a tiny droplet.',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
