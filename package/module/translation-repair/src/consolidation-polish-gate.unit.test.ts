/**
 * Tests fidelity-first naturalness gate policy and settlement.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildConsolidationPolishGateMessages,
  type ConsolidationPolishBallot,
  messageText,
  settleConsolidationPolishBallots,
} from '../dist/final/node/index.mjs';

/**
 * Ballot choosing requested candidate.
 *
 * @param choice - candidate selected
 *
 * @returns Usable polish ballot
 *
 * @example
 * ```ts
 * const value = ballot({ choice: 'polished', });
 * ```
 */
function ballot(
  { choice, }: { readonly choice: ConsolidationPolishBallot['choice']; },
): ConsolidationPolishBallot {
  return {
    choice,
    unsupported: [],
    unsupportedRaw: [],
    dropped: [],
    droppedRaw: [],
    reason: 'scripted',
  };
}

await describe({
  name: settleConsolidationPolishBallots.name,
  children: [
    it({
      name: 'ACCEPTS CLEAR POLISH WIN and keeps base on ties or thin support',
      fn: async () => {
        expect(settleConsolidationPolishBallots({
          ballots: [
            ballot({ choice: 'polished', },),
            ballot({ choice: 'polished', },),
            ballot({ choice: 'base', },),
          ],
        },),).toBe('polished',);
        expect(settleConsolidationPolishBallots({
          ballots: [
            ballot({ choice: 'polished', },),
            ballot({ choice: 'base', },),
          ],
        },),).toBe('neither',);
        expect(settleConsolidationPolishBallots({
          ballots: [ballot({ choice: 'polished', },),],
        },),).toBe('neither',);
        expect(settleConsolidationPolishBallots({
          ballots: [
            ballot({ choice: 'polished', },),
            ballot({ choice: 'polished', },),
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
          ],
        },),).toBe('polished',);
      },
    },),
  ],
},);

await describe({
  name: buildConsolidationPolishGateMessages.name,
  children: [
    it({
      name: 'MAKES FIDELITY A FLOOR before judging literal collocations and calques',
      fn: async () => {
        const system = buildConsolidationPolishGateMessages({
          subject: {
            sourceText: '猫猫积极地面对生活。',
            archiveText: 'The cat approached life positively.',
            baseText: 'The cat faced life proactively.',
            polishedText: 'The cat maintained a positive outlook on life.',
            mode: { kind: 'comparative', },
          },
        },).at(0,)?.content ?? '';
        expect(system,).toContain('Naturalness can never compensate',);
        expect(system,).toContain('calqued verb-object combinations',);
        expect(system,).toContain('Prefer polished only when it is clearly more idiomatic',);
      },
    },),

    it({
      name: 'TREATS REJECTED BASE AS EVIDENCE rather than an approved fallback during required correction',
      fn: async () => {
        const messages = buildConsolidationPolishGateMessages({
          subject: {
            sourceText: '猫猫需要关爱。',
            archiveText: 'The cat needed care.',
            baseText: 'The cat was short on caring.',
            polishedText: 'The cat needed affection.',
            mode: {
              kind: 'required-naturalness-correction',
              findings: [{ paragraph: 1, problem: 'Replace the literal emotional phrase.', },],
            },
          },
        },);
        /**
         * Complete correction gate sheet across system and user messages.
         */
        const sheet = messages.map(function text(message,): string {
          return messageText({ message, },);
        },)
          .join('\n',);
        expect(sheet,).toContain('base already failed absolute naturalness review',);
        expect(sheet,).toContain('must not win merely because improvement is unclear',);
        expect(sheet,).toContain('Paragraph 1: Replace the literal emotional phrase.',);
        expect(sheet,).toContain('CANDIDATE "base" (rejected naturalness evidence only)',);
      },
    },),
  ],
},);
