/**
 Guards class ninety-seven (yingying5, 2026-09-23): a candidate that renders
 a passage the original addresses in the second person (你, 您) with no
 second-person pronoun and a third-person one instead is refused before any
 judge reads it, since a pronoun the original writes is rendered as written
 where it stands (class eighty-one). A greeting (你好) is no address, and a
 rendering carrying no pronoun at all is left to the judges. Cat-themed
 invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { validateTranslatedSlice, } from '../dist/final/node/index.mjs';

/**
 Original wish addressing the cat directly.
 */
const ADDRESSED = '愿在你的下一个世界，你还有同样的开朗去追你想追的蝴蝶吧！';

/**
 Rendering that keeps the address.
 */
const KEPT = 'May you still have the same cheer to chase the butterflies you want to chase in your next world!';

/**
 Rendering that turned the address into narration.
 */
const NARRATED = 'May she still have the same cheer to chase the butterflies she wanted to chase in her next world!';

await describe({
  name: 'a second-person address the original passage carries (class ninety-seven)',
  children: [
    it({
      name: 'REFUSES a candidate that renders 你 with no second-person pronoun and a third-person one instead',
      fn: async () => {
        /**
         Verdict on the narrated rendering.
         */
        const verdict = validateTranslatedSlice({
          sourceText: ADDRESSED,
          candidateText: NARRATED,
        },);
        expect(verdict.kind,).toBe('invalid',);
        if (verdict.kind !== 'invalid')
          throw new Error('unreachable',);
        expect(verdict.findings.join('\n',),).toContain('second person',);
      },
    },),
    it({
      name: 'ACCEPTS the address kept, a greeting rendered as a greeting, and a rendering carrying no pronoun at all',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: ADDRESSED,
          candidateText: KEPT,
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '她说「你好。再见。」',
          candidateText: 'She said “Hello. Goodbye.”',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '啊，干干你的',
          candidateText: 'Ah, wanna play?',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '<!-- 你 --> 猫猫睡了。',
          candidateText: 'The cat slept, and she dreamed.',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
