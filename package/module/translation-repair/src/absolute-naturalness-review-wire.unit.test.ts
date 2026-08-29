/**
 * Tests absolute naturalness reviewer prompt and reply consistency guard.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  buildAbsoluteNaturalnessReviewMessages,
  isAbsoluteNaturalnessReviewWire,
  messageText,
} from '../dist/final/node/index.mjs';

await describe({
  name: isAbsoluteNaturalnessReviewWire.name,
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
  ],
},);

await describe({
  name: buildAbsoluteNaturalnessReviewMessages.name,
  children: [
    it({
      name: 'ASKS ABSOLUTE WHOLE-CANDIDATE QUALITY instead of comparative improvement',
      fn: async () => {
        const messages = buildAbsoluteNaturalnessReviewMessages({
          subject: {
            sourceText: '猫猫在窗台上睡觉。',
            candidateText: 'The cat sleeps on the windowsill.',
            paragraphs: ['The cat sleeps on the windowsill.',],
            identityContext: 'Mimi (@mimi_cat)',
          },
        },);
        /**
         * Complete reviewer sheet across system and user messages.
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
},);
