/**
 Guards class ninety-seven (2026-09-23): a candidate that renders
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
const ADDRESSED = '明天早上，你还要陪我去院子里追那只黄蝴蝶哦！';

/**
 Rendering that keeps the address.
 */
const KEPT = 'Tomorrow morning, you still have to come chase that yellow butterfly in the yard with me!';

/**
 Rendering that turned the address into narration.
 */
const NARRATED = 'Tomorrow morning, she still has to come chase that yellow butterfly in the yard with me!';

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
    it({
      name: 'ACCEPTS 你看 and 你瞧 opening a clause as the imperative "look", which English writes without "you" '
        + '(class one hundred eighty-five: the rendering\'s "she" rendered the original\'s own 她)',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: '所以她是只温柔的猫吧。你看窗台上，她在最小的角落里睡出了最甜的梦。',
          candidateText: 'So she was a gentle cat. Look at the windowsill: in the smallest corner she dreamed '
            + 'the sweetest dream.',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '「你瞧你瞧，她又醒了！」',
          candidateText: '“Look, look, she’s awake again!”',
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'STILL REFUSES 你看 as a verb with its object or complement (被你看到, 你看到了) where the address drops',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: '那只猫偷吃鱼干的样子，全被你看到了。',
          candidateText: 'Even the cat sneaking dried fish was seen by her.',
        },).kind,).toBe('invalid',);
        expect(validateTranslatedSlice({
          sourceText: '你看到她睡着了吗？',
          candidateText: 'Did she see her fall asleep?',
        },).kind,).toBe('invalid',);
      },
    },),
  ],
},);
