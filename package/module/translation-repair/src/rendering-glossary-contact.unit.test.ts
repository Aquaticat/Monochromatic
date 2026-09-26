/**
 Guards class one hundred fifty-eight (aiyysk2, 2026-09-26): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), 交往 joins the rendering glossary. A
 narrator who had never spent time with trans women, and was too shy to
 approach them, shipped as someone who had "never dated a trans woman", a
 romance the original never states. The glossary seeds English for ordinary
 social contact and refuses the dating reading.

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
 Original in which the kitten has never spent time with barn cats.
 */
const CONTACT = '小猫之前也没和谷仓猫交往过，所以不敢接近它们。';

await describe({
  name: 'the social contact the rendering glossary renders (class one hundred fifty-eight)',
  children: [
    it({
      name: 'SEEDS 交往 with "talked to" first',
      fn: async () => {
        /**
         The seeded entry.
         */
        const entry = RENDERING_GLOSSARY.find(function isTerm(candidate,): boolean {
          return candidate.term === '交往';
        },);
        expect(entry?.renderings[0],).toBe('talked to',);
      },
    },),
    it({
      name: 'REFUSES "never dated" and passes ordinary contact',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: CONTACT,
          candidateText: 'The kitten had never dated a barn cat, so it was afraid to approach them.',
        },).kind,).toBe('invalid',);
        expect(validateTranslatedSlice({
          sourceText: CONTACT,
          candidateText: 'The kitten had never really talked to a barn cat, so it was afraid to approach them.',
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'PASSES "updated", which holds the letters of "dated" without the word',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: CONTACT,
          candidateText: 'The kitten, who updated nobody, had never talked to a barn cat and kept away from them.',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
