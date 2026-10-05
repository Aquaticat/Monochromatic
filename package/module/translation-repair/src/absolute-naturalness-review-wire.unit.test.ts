/**
 Tests absolute naturalness reviewer prompt and reply consistency guard.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  type AbsoluteNaturalnessReviewWire,
  buildAbsoluteNaturalnessReviewMessages,
  isAbsoluteNaturalnessReviewWire,
  messageText,
} from '../dist/final/node/index.mjs';

/**
 Otherwise-valid reply each structural-malformation case corrupts in one field.
 */
const VALID_REVIEW: AbsoluteNaturalnessReviewWire = {
  acceptable: false,
  findings: [{ paragraph: 2, problem: 'Avoid literal word-for-word order.', },],
  reason: 'retains source phrasing',
};

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: isAbsoluteNaturalnessReviewWire.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REQUIRES FINDINGS exactly for unacceptable verdict',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire({
              acceptable: true,
              findings: [],
              reason: 'ready',
            },),).toBe(true,);
            expect(isAbsoluteNaturalnessReviewWire({
              acceptable: false,
              findings: [{ paragraph: 1, problem: 'Replace stiff syntax.', },],
              reason: 'translationese remains',
            },),).toBe(true,);
            expect(isAbsoluteNaturalnessReviewWire({
              acceptable: true,
              findings: [{ paragraph: 1, problem: 'Optional preference.', },],
              reason: 'contradictory',
            },),).toBe(false,);
            expect(isAbsoluteNaturalnessReviewWire({
              acceptable: false,
              findings: [],
              reason: 'contradictory',
            },),).toBe(false,);
          },
        },),

        it({
          name: 'ACCEPTS the otherwise-valid reply each refusal case corrupts in one field, so each refusal is '
            + 'that field\'s',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire(VALID_REVIEW,),).toBe(true,);
          },
        },),

        it({
          name: 'REFUSES A NON-BOOLEAN acceptable field',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire({ ...VALID_REVIEW, acceptable: 'false', },),)
              .toBe(false,);
          },
        },),

        it({
          name: 'REFUSES A REPLY MISSING findings',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire({
              acceptable: false,
              reason: 'retains source phrasing',
            },),).toBe(false,);
          },
        },),

        it({
          name: 'REFUSES A NON-ARRAY findings field',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire({ ...VALID_REVIEW, findings: 'many', },),)
              .toBe(false,);
          },
        },),

        it({
          name: 'REFUSES A FINDING THAT IS NOT A RECORD',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire({
              ...VALID_REVIEW,
              findings: [['paragraph', 1,],],
            },),).toBe(false,);
          },
        },),

        it({
          name: 'REFUSES A FINDING WITH A NON-NUMBER paragraph',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire({
              ...VALID_REVIEW,
              findings: [{ paragraph: '2', problem: 'Avoid literal word-for-word order.', },],
            },),).toBe(false,);
          },
        },),

        it({
          name: 'REFUSES A FINDING WITH A NON-INTEGER paragraph',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire({
              ...VALID_REVIEW,
              findings: [{ paragraph: 1.5, problem: 'Avoid literal word-for-word order.', },],
            },),).toBe(false,);
          },
        },),

        it({
          name: 'REFUSES A FINDING WITH paragraph BELOW ONE',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire({
              ...VALID_REVIEW,
              findings: [{ paragraph: 0, problem: 'Avoid literal word-for-word order.', },],
            },),).toBe(false,);
          },
        },),

        it({
          name: 'REFUSES A FINDING WITH A NON-STRING problem',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire({
              ...VALID_REVIEW,
              findings: [{ paragraph: 2, problem: 7, },],
            },),).toBe(false,);
          },
        },),

        it({
          name: 'REFUSES A FINDING WITH AN EMPTY problem',
          fn: async () => {
            // The one finding-level refusal decided by the finding check's last
            // question, whether the problem shows a reader anything, rather
            // than by a type or range check; it refuses the reply through the
            // same `every` as the other finding-level cases.
            expect(isAbsoluteNaturalnessReviewWire({
              ...VALID_REVIEW,
              findings: [{ paragraph: 2, problem: '', },],
            },),).toBe(false,);
          },
        },),

        it({
          name: 'REFUSES A FINDING WHOSE problem SHOWS A READER NOTHING, as it refuses an empty one: spaces, a '
            + 'zero-width space, a Hangul filler, or both among spaces',
          fn: async () => {
            expect([
              '   ',
              '\u{200B}',
              '\u{3164}',
              ' \u{200B}\u{3164} ',
            ].map(function guarded(problem,) {
              return isAbsoluteNaturalnessReviewWire({
                ...VALID_REVIEW,
                findings: [{ paragraph: 2, problem, },],
              },);
            },),).toEqual([
              false,
              false,
              false,
              false,
            ],);
          },
        },),

        it({
          name: 'REFUSES A REPLY MISSING reason',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire({
              acceptable: false,
              findings: [{ paragraph: 2, problem: 'Avoid literal word-for-word order.', },],
            },),).toBe(false,);
          },
        },),

        it({
          name: 'REFUSES A NON-STRING reason field',
          fn: async () => {
            expect(isAbsoluteNaturalnessReviewWire({ ...VALID_REVIEW, reason: 7, },),)
              .toBe(false,);
          },
        },),
      ],
    },),

    describe({
      name: buildAbsoluteNaturalnessReviewMessages.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ASKS ABSOLUTE WHOLE-CANDIDATE QUALITY instead of comparative improvement',
          fn: async () => {
            const messages = buildAbsoluteNaturalnessReviewMessages({
              subject: {
                lineStructured: false,
                sourceText: '猫猫在窗台上睡觉。',
                candidateText: 'The cat sleeps on the windowsill.',
                paragraphs: ['The cat sleeps on the windowsill.',],
                identityContext: 'Mimi (@mimi_cat)',
              },
            },);
            /**
             Complete reviewer sheet across system and user messages.
             */
            const sheet = messages.map(function text(message,): string {
              return messageText({ message, },);
            },)
              .join('\n',);
            expect(sheet,).toContain('absolute naturalness floor',);
            expect(sheet,).toContain('not against another candidate',);
            expect(sheet,).toContain('Judge the ENTIRE English candidate',);
            expect(sheet,).toContain('stacked time or aspect adverbs',);
            expect(sheet,).toContain('Perform two independent scans before deciding',);
            expect(sheet,).toContain('return the union of material defects',);
            expect(sheet,).toContain('soft breaks that render as spaces',);
            expect(sheet,).toContain('after replacing each soft break with a space',);
            expect(sheet,).toContain('Mimi (@mimi_cat)',);
          },
        },),

        it({
          name: 'GIVES CONFIRMATION SUBSTANTIVELY DISTINCT CHALLENGE RESPONSIBILITY',
          fn: async () => {
            /** Shared exact candidate subject for both responsibilities. */
            const subject = {
              lineStructured: false,
              sourceText: '猫猫在窗台上睡觉。',
              candidateText: 'The cat sleeps on the windowsill.',
              paragraphs: ['The cat sleeps on the windowsill.',],
            };
            const discovery = buildAbsoluteNaturalnessReviewMessages({
              subject,
              perspective: 'defect-discovery',
            },);
            const challenge = buildAbsoluteNaturalnessReviewMessages({
              subject,
              perspective: 'acceptance-challenge',
            },);
            expect(JSON.stringify(challenge,),).not.toBe(JSON.stringify(discovery,),);
            expect(messageText({ message: nonNullishOrThrow(discovery[0],), },),).toContain(
              'without relying on any prior verdict',
            );
            expect(messageText({ message: nonNullishOrThrow(challenge[0],), },),).toContain(
              'A prior editor accepted this exact candidate',
            );
            expect(messageText({ message: nonNullishOrThrow(challenge[0],), },),).toContain(
              'work backward through each paragraph and sentence',
            );
          },
        },),
      ],
    },),
  ],
},);
