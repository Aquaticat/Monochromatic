/**
 Guards class one hundred eighty-four (TianqiChen66616, 2026-09-27): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), two words of the kigurumi and fan
 community join the fandom glossary. 变娃 (the performers' word for putting on
 the costume and becoming the doll) shipped as "in this game of becoming a
 doll", and English "doll up" means dressing smartly; 治愈 (the comfort a
 person or work gives, as in 治愈系) shipped as "those she had healed", which
 reads as curing a wound or an illness.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  COMMUNITY_GLOSSARY,
  communityTermsIn,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 Original in which the cat puts on its kigurumi and becomes one with the doll.
 */
const SUITED = '这次变娃娃，猫真的要和娃娃融为一体了。';

/**
 Original in which the cat glimpses the kittens its visits comforted.
 */
const COMFORTED = '猫看见了被它治愈的小猫们。';

/**
 First rendering the glossary seeds for a term.

 @param term - Han form to look up

 @returns Leading rendering, or undefined where the term is not seeded

 @example
 ```ts
 const first = firstRendering({ term: '变娃', },);
 ```
 */
function firstRendering({ term, }: { readonly term: string; },): string | undefined {
  return COMMUNITY_GLOSSARY.find(function isTerm(entry,): boolean {
    return entry.term === term;
  },)?.renderings[0];
}

await describe({
  name: 'kigurumi and fan words the community glossary renders (class one hundred eighty-four)',
  children: [
    it({
      name: 'SEEDS 变娃 with "put on the kigurumi" first and 治愈 with "comforted" first',
      fn: async () => {
        expect(firstRendering({ term: '变娃', },),).toBe('put on the kigurumi',);
        expect(firstRendering({ term: '治愈', },),).toBe('comforted',);
      },
    },),
    it({
      name: 'FINDS 变娃 inside 变娃娃 and 治愈 inside 被它治愈',
      fn: async () => {
        expect(communityTermsIn({ text: SUITED, },).map(function termOf(entry,): string {
          return entry.term;
        },),).toContain('变娃',);
        expect(communityTermsIn({ text: COMFORTED, },).map(function termOf(entry,): string {
          return entry.term;
        },),).toContain('治愈',);
      },
    },),
    it({
      name: 'REFUSES "dolled up", the English idiom for dressing smartly',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: SUITED,
          candidateText: 'This time, all dolled up, the cat truly became one with the doll.',
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'PASSES the kigurumi sense and the comfort sense',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: SUITED,
          candidateText: 'This time, in its kigurumi, the cat truly became one with the doll.',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: COMFORTED,
          candidateText: 'The cat saw the kittens it had comforted.',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
