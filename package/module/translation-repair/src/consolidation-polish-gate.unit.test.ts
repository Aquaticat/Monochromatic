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
          },
        },).at(0,)?.content ?? '';
        expect(system,).toContain('Naturalness can never compensate',);
        expect(system,).toContain('calqued verb-object combinations',);
        expect(system,).toContain('Prefer polished only when it is clearly more idiomatic',);
      },
    },),
  ],
},);
