/**
 Guards class one hundred fifty (shi_Yumiaoya36, 2026-09-26): an original
 that names a suicide (自杀, 自尽, 轻生) shipped as "she overdosed", which
 drops the attempt the original states and names the means the house rule
 keeps vague. A survived attempt is still an attempt: the page says she
 attempted suicide or tried to end her life, and a candidate carrying no
 wording for suicide at all is refused before any judge reads it. The floor
 asks only that the suicide be said; how vaguely the means are put stays with
 the judges. Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { validateTranslatedSlice, } from '../dist/final/node/index.mjs';

/**
 Original telling of a cat's survived attempt.
 */
const ATTEMPT = '那天凌晨，橘猫吞下大量药物自杀，抢救三天后终于醒来了。';

/**
 Rendering that says the attempt.
 */
const SAID = 'In the early hours of that day, the ginger cat attempted suicide; after three days of emergency care she finally woke up.';

/**
 Rendering that names the means and drops the attempt.
 */
const DROPPED = 'In the early hours of that day, the ginger cat overdosed; after three days of emergency care she finally woke up.';

/**
 Verdict kind of a rendering against an original.

 @param sourceText - original passage

 @param candidateText - rendering under the floor

 @returns Kind of the verdict

 @example
 ```ts
 verdictKind({ sourceText: ATTEMPT, candidateText: SAID, },); // 'valid'
 ```
 */
function verdictKind(
  {
    sourceText,
    candidateText,
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
  },
): string {
  return validateTranslatedSlice({
    sourceText,
    candidateText,
  },).kind;
}

await describe({
  name: 'a suicide the original passage names (class one hundred fifty)',
  children: [
    it({
      name: 'REFUSES a candidate that renders 自杀 with no wording for suicide at all',
      fn: async () => {
        /**
         Verdict on the rendering that dropped the attempt.
         */
        const verdict = validateTranslatedSlice({
          sourceText: ATTEMPT,
          candidateText: DROPPED,
        },);
        expect(verdict.kind,).toBe('invalid',);
        if (verdict.kind !== 'invalid')
          throw new Error('unreachable',);
        expect(verdict.findings.join('\n',),).toContain('suicide',);
      },
    },),
    it({
      name: 'ACCEPTS every plain way of saying it, the same for 自尽 and 轻生, and a comment\'s 自杀 asks nothing',
      fn: async () => {
        expect(verdictKind({
          sourceText: ATTEMPT,
          candidateText: SAID,
        },),).toBe('valid',);
        expect(verdictKind({
          sourceText: ATTEMPT,
          candidateText: 'That night the ginger cat tried to end her own life, and three days later she woke up.',
        },),).toBe('valid',);
        expect(verdictKind({
          sourceText: '白猫说：「你可别自杀啊。」',
          candidateText: 'The white cat said, “Don’t you go killing yourself.”',
        },),).toBe('valid',);
        expect(verdictKind({
          sourceText: '黑猫自尽了。',
          candidateText: 'The black cat took her own life.',
        },),).toBe('valid',);
        expect(verdictKind({
          sourceText: '她有过轻生的念头。',
          candidateText: 'She had had suicidal thoughts.',
        },),).toBe('valid',);
        expect(verdictKind({
          sourceText: '<!-- 自杀 --> 猫猫睡了。',
          candidateText: 'The cat slept.',
        },),).toBe('valid',);
      },
    },),
    it({
      name: 'REFUSES the same drop for 自尽 and 轻生',
      fn: async () => {
        expect(verdictKind({
          sourceText: '黑猫自尽了。',
          candidateText: 'The black cat passed away.',
        },),).toBe('invalid',);
        expect(verdictKind({
          sourceText: '她有过轻生的念头。',
          candidateText: 'She had had dark thoughts.',
        },),).toBe('invalid',);
      },
    },),
  ],
},);
