/**
 Guards class one hundred fifty-four (shi_Yumiaoya38, 2026-09-26): 跨圈,
 the community's short form of 跨性别圈子, shipped as "the crossdressing
 community" on one of the page's four uses while the other three read "the
 trans community", and shi_Yumiaoya37 had read it "across different
 communities". The archive renders it "the Trans Community" (shihai4h's
 heading). The glossary seeds the term with that rendering, and a candidate
 writing "crossdressing community" for it is refused before any judge reads
 it. Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  COMMUNITY_GLOSSARY,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 Original naming the community.
 */
const NAMED = '此后，猫猫在跨圈内结识了很多朋友。';

/**
 Rendering that read the community as a crossdressing one.
 */
const MISREAD = 'After that, the cat made many friends in the crossdressing community.';

/**
 Rendering in the archive's words.
 */
const RENDERED = 'After that, the cat made many friends in the trans community.';

await describe({
  name: 'the trans community the glossary renders (class one hundred fifty-four)',
  children: [
    it({
      name: 'SEEDS 跨圈 with the archive\'s "trans community" first, and refuses "crossdressing community"',
      fn: async () => {
        /**
         The seeded entry.
         */
        const entry = COMMUNITY_GLOSSARY.find(function isTerm(candidate,): boolean {
          return candidate.term === '跨圈';
        },);
        expect(entry?.renderings[0],).toBe('trans community',);
        expect(entry?.refusedForms,).toContain('crossdressing community',);
        expect(entry?.refusedForms,).toContain('cross-dressing community',);
      },
    },),
    it({
      name: 'REFUSES a candidate reading 跨圈 as the crossdressing community, and passes the trans community',
      fn: async () => {
        /**
         Verdict on the misreading.
         */
        const misread = validateTranslatedSlice({
          sourceText: NAMED,
          candidateText: MISREAD,
        },);
        /**
         Verdict on the archive's rendering.
         */
        const rendered = validateTranslatedSlice({
          sourceText: NAMED,
          candidateText: RENDERED,
        },);
        expect(misread.kind,).toBe('invalid',);
        expect(JSON.stringify(misread,),).toContain('crossdressing community',);
        expect(rendered.kind,).toBe('valid',);
      },
    },),
  ],
},);
