/**
 Guards class one hundred twenty-five (shi_Yumiaoya25, 2026-09-25): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), two calques on the page join the rendering
 glossary. 滑档二本 shipped as "slid down into a second-tier admission slot",
 where the English is that she missed her chosen schools and ended up at a
 second-tier university; 用这种方式告诉 shipped as "using this way to tell",
 which is not English. Each form appears once in the pinned corpus, on that
 page.

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
 Original in which the cat misses its chosen schools and lands at a
 second-tier university.
 */
const ADMISSION = '这只猫志愿填错了，滑档二本。';

/**
 Original in which the cat tells everyone something by its nap.
 */
const MEANS = '这只猫只是用这种方式告诉大家要多睡觉。';

/**
 Entry the glossary holds for a term, or undefined.

 @param term - Han form to look up

 @returns Entry the glossary seeds for the term

 @throws Error when the glossary lacks the term, which is the failure this
 guard exists to show

 @example
 ```ts
 const entry = entryFor({ term: '二本', },);
 ```
 */
function entryFor({ term, }: { readonly term: string; },): (typeof RENDERING_GLOSSARY)[number] {
  /**
   Entry for the term, if seeded.
   */
  const found = RENDERING_GLOSSARY.find(function isTerm(entry,): boolean {
    return entry.term === term;
  },);
  if (found === undefined)
    throw new Error(`rendering glossary does not seed ${term}`,);
  return found;
}

await describe({
  name: 'calques the rendering glossary refuses (class one hundred twenty-five)',
  children: [
    it({
      name: 'SEEDS 滑档, 二本 and 用这种方式 with the English the page uses',
      fn: async () => {
        expect(entryFor({ term: '二本', },).renderings[0],).toBe('second-tier university',);
        expect(entryFor({ term: '二本', },).refusedForms,).toContain('admission slot',);
        expect(entryFor({ term: '滑档', },).refusedForms,).toContain('slid down',);
        expect(entryFor({ term: '用这种方式', },).refusedForms,).toContain('using this way to',);
      },
    },),
    it({
      name: 'REFUSES the calques the page shipped',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: ADMISSION,
          candidateText: 'The cat filled in the wrong choices and slid down into a second-tier admission slot.',
        },).kind,).toBe('invalid',);
        expect(validateTranslatedSlice({
          sourceText: MEANS,
          candidateText: 'The cat was only using this way to tell everyone to sleep more.',
        },).kind,).toBe('invalid',);
        expect(validateTranslatedSlice({
          sourceText: ADMISSION,
          candidateText: 'The cat filled in the wrong choices and slipped to a second-tier university.',
        },).kind,).toBe('invalid',);
        // shi_Yumiaoya26 dodged the refused form with "using this method to
        // tell", the same calque with another noun.
        expect(validateTranslatedSlice({
          sourceText: MEANS,
          candidateText: 'The cat was only using this method to tell everyone to sleep more.',
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'ACCEPTS the English meaning',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: ADMISSION,
          candidateText: 'The cat filled in the wrong choices, missed its chosen schools and ended up at a second-tier university.',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: MEANS,
          candidateText: 'This was only the cat\'s way of telling everyone to sleep more.',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
