/**
 Guards class one hundred eighty-three (TianqiChen66614, 2026-09-27): the
 quote 我会在离开我们的时候以kigurumi的记忆结束 shipped as "when I leave you
 all, they will end with the memories of kigurumi", memories ending with
 memories, where the source's subject is 我. The archive reads "they" too, so
 the bench kept it. The owner's standing instruction of 2026-09-25 ("whenever
 you see anything that can be translated better do it") and of 2026-09-27
 ("Always fix and re-launch") put the phrase in the rendering glossary with
 the moved subject refused.

 Cat-themed invention throughout; no corpus content appears here beyond the
 glossary term itself.

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
 Original in which the cat says it will end with its kigurumi memories.
 */
const PROMISE = '猫说：离开的时候，我会以kigurumi的记忆结束。';

/**
 Candidate that hands the clause to the memories.
 */
const MOVED = 'The cat said: when I leave, they will end with the memories of kigurumi.';

/**
 Candidate keeping the cat as the subject.
 */
const KEPT = 'The cat said: when I leave, I will end with memories of kigurumi.';

await describe({
  name: 'a first-person clause the rendering glossary keeps first-person (class one hundred eighty-three)',
  children: [
    it({
      name: 'SEEDS kigurumi的记忆结束 with the speaker as the subject first',
      fn: async () => {
        expect(RENDERING_GLOSSARY.find(function isTerm(entry,): boolean {
          return entry.term === 'kigurumi的记忆结束';
        },)?.renderings[0],).toBe('I will end with memories of kigurumi',);
      },
    },),
    it({
      name: 'REFUSES "they will end with" for the speaker\'s clause',
      fn: async () => {
        expect(validateTranslatedSlice({ sourceText: PROMISE, candidateText: MOVED, },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'PASSES the clause with the speaker kept',
      fn: async () => {
        expect(validateTranslatedSlice({ sourceText: PROMISE, candidateText: KEPT, },).kind,).toBe('valid',);
      },
    },),
  ],
},);
