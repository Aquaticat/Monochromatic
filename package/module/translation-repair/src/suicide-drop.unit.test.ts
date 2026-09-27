/**
 Guards class one hundred fifty (2026-09-26): an original that names a
 suicide (自杀, 自尽, 轻生) shipped in wording that dropped the attempt the
 original states and put in its place a detail the house rule keeps vague.
 A survived attempt is still an attempt: the page says she
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
const ATTEMPT = '那年冬天，橘猫曾经试图自杀，休养了很久才慢慢好起来。';

/**
 Rendering that says the attempt.
 */
const SAID = 'That winter, the ginger cat attempted suicide; after a long rest she slowly recovered.';

/**
 Rendering that drops the attempt behind a vague illness.
 */
const DROPPED = 'That winter, the ginger cat fell gravely ill; after a long rest she slowly recovered.';

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
          candidateText: 'That winter the ginger cat tried to end her own life, and after a long rest she slowly recovered.',
        },),).toBe('valid',);
        expect(verdictKind({
          sourceText: '老猫对小猫说：「你千万别想着自杀。」',
          candidateText: 'The old cat told the kitten, “Don’t you ever think of killing yourself.”',
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
      name: 'ACCEPTS an attempt on a life, a death by one\'s own hand, and a quotation of a published work in its '
        + 'published English (ledger F-4: the replay refused "attempts on her own life" and a canonical quotation '
        + 'whose Chinese translation added 自杀)',
      fn: async () => {
        expect(verdictKind({
          sourceText: ATTEMPT,
          candidateText: 'That winter the ginger cat made an attempt on her own life; after a long rest she slowly '
            + 'recovered.',
        },),).toBe('valid',);
        expect(verdictKind({
          sourceText: '尽管经历了数次自杀尝试，老猫仍然每天晒太阳。',
          candidateText: 'Despite several attempts on his own life, the old cat still sunned himself every day.',
        },),).toBe('valid',);
        expect(verdictKind({
          sourceText: '黑猫自尽了。',
          candidateText: 'The black cat died by her own hand.',
        },),).toBe('valid',);
        expect(verdictKind({
          sourceText: '> 「这场游戏由清醒过渡到逃遁。我们应该沿着这条线索去理解自杀。」\n>\n> ——喵喵《猫的神话》',
          candidateText: '> One must follow and understand this game that leads from lucidity to flight.\n>\n'
            + '> — Meow Meow, *The Myth of the Cat*',
        },),).toBe('valid',);
      },
    },),
    it({
      name: 'STILL REFUSES a hand that only wrote, an unattributed quotation without the word, and names no '
        + 'pronoun the passage did not choose',
      fn: async () => {
        expect(verdictKind({
          sourceText: '橘猫自杀前，亲手写了一封信。',
          candidateText: 'Before she left, the ginger cat wrote a letter by her own hand.',
        },),).toBe('invalid',);
        expect(verdictKind({
          sourceText: '> 「千万别自杀。」',
          candidateText: '> “Please don’t go.”',
        },),).toBe('invalid',);
        /**
         Verdict on a drop about a cat the passage calls 他.
         */
        const verdict = validateTranslatedSlice({
          sourceText: '黑猫自杀了。',
          candidateText: 'The black cat passed away.',
        },);
        expect(verdict.kind === 'invalid' ? verdict.findings.join('\n',) : '',).not.toContain(' she ',);
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
