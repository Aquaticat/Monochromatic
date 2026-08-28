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
        expect(sheet,).toContain('Mimi (@mimi_cat)',);
      },
    },),
  ],
},);
