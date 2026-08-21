/**
 * Tests for the sheet and the ballot reading of the consolidation gate.
 *
 * WHAT THIS FILE EXISTS TO STOP. The gate asks the lane contest's question over
 * a different pair of names, and the pieces it shares with that contest are
 * shared rather than copied. These tests hold the shared reading to the same
 * behaviour on this vocabulary: a finding written as a phrase never costs a
 * voice, and an annotated name still names its candidate.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  buildConsolidateGateMessages,
  isConsolidateGateWire,
  readConsolidateGateBallot,
} from '../dist/final/node/index.mjs';

/**
 * One gated slice, standing in for a corpus passage.
 */
const SUBJECT = {
  sourceText: '猫在窗台上睡觉。',
  incumbentText: 'The cat sleeps on the sill, purring.',
  consolidatedText: 'The cat sleeps on the window sill.',
  standingText: 'The cat is napping on the ledge.',
};

/**
 * Joins the content of every message in one exchange.
 *
 * @param subject - what the judge is shown
 *
 * @returns Every message's content, joined
 *
 * @example
 * ```ts
 * const shown = exchangeFor({ subject: SUBJECT, },);
 * ```
 */
function exchangeFor(
  { subject, }: { readonly subject: typeof SUBJECT; },
): string {
  return buildConsolidateGateMessages({ subject, },)
    .map(function contentOf(message,): string {
      return message.content;
    },)
    .join('\n',);
}

/**
 * Joins only what the judge is shown, leaving out the instructions.
 *
 * SEPARATE FROM THE WHOLE EXCHANGE, because the shared policy names declared
 * names as a rule whether or not this slice has any, so a test asking whether
 * the block was rendered would pass on the rule's own wording.
 *
 * @param subject - what the judge is shown
 *
 * @returns User content
 *
 * @example
 * ```ts
 * const shown = shownFor({ subject: SUBJECT, },);
 * ```
 */
function shownFor(
  { subject, }: { readonly subject: typeof SUBJECT; },
): string {
  return buildConsolidateGateMessages({ subject, },)
    .filter(function isShown(message,): boolean {
      return message.role === 'user';
    },)
    .map(function contentOf(message,): string {
      return message.content;
    },)
    .join('\n',);
}

await describe({
  name: isConsolidateGateWire.name,
  children: [
    it({
      name: 'ACCEPTS each name this contest allows',
      fn: async () => {
        for (const choice of [ 'consolidated', 'standing', 'neither', ])
          expect(isConsolidateGateWire({
            choice,
            unsupported: [],
            dropped: [],
            reason: 'the original supports it',
          },),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES a lane name, which belongs to the other contest',
      fn: async () => {
        expect(isConsolidateGateWire({
          choice: 'repair',
          unsupported: [],
          dropped: [],
          reason: 'x',
        },),).toBe(false,);
      },
    },),
    it({
      name: 'ACCEPTS findings written as phrases rather than candidate names',
      fn: async () => {
        // NO WORDING OF A FINDING MAY COST A VOICE, which is what the lane
        // contest's calibration paid two voices to learn.
        expect(isConsolidateGateWire({
          choice: 'standing',
          unsupported: [ 'napping in the sun', ],
          dropped: [ 'the second bowl', ],
          reason: 'x',
        },),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: readConsolidateGateBallot.name,
  children: [
    it({
      name: 'reads an annotated name as naming that candidate',
      fn: async () => {
        const ballot = readConsolidateGateBallot({
          wire: {
            choice: 'standing',
            unsupported: [ 'consolidated (invents an afternoon)', ],
            dropped: [],
            reason: 'x',
          },
        },);
        expect(ballot.unsupported,).toEqual([ 'consolidated', ],);
      },
    },),
    it({
      name: 'REFUSES to read a longer word beginning with a name as that name',
      fn: async () => {
        const ballot = readConsolidateGateBallot({
          wire: {
            choice: 'standing',
            unsupported: [ 'consolidating the two loses the ledge', ],
            dropped: [],
            reason: 'x',
          },
        },);
        expect(ballot.unsupported,).toEqual([],);
      },
    },),
    it({
      name: 'keeps a judge\'s own words beside the narrowed list',
      fn: async () => {
        const ballot = readConsolidateGateBallot({
          wire: {
            choice: 'consolidated',
            unsupported: [],
            dropped: [ 'the window ledge', ],
            reason: 'the original names a sill',
          },
        },);
        expect(ballot.dropped,).toEqual([],);
        expect(ballot.droppedRaw,).toEqual([ 'the window ledge', ],);
      },
    },),
  ],
},);

await describe({
  name: buildConsolidateGateMessages.name,
  children: [
    it({
      name: 'names the two renderings the judge must choose between',
      fn: async () => {
        const shown = shownFor({ subject: SUBJECT, },);
        expect(shown,).toContain('CANDIDATE "consolidated"',);
        expect(shown,).toContain('CANDIDATE "standing"',);
      },
    },),
    it({
      name: 'shows the original as the standard and the archive as evidence',
      fn: async () => {
        const shown = exchangeFor({ subject: SUBJECT, },);
        expect(shown,).toContain('THE ORIGINAL IS THE STANDARD',);
        expect(shown,).toContain('ARCHIVE RENDERING, evidence only',);
      },
    },),
    it({
      name: 'asks the two findings questions the lane contest asks',
      fn: async () => {
        const shown = exchangeFor({ subject: SUBJECT, },);
        expect(shown,).toContain('UNSUPPORTED',);
        expect(shown,).toContain('DROPPED',);
      },
    },),
    it({
      name: 'REFUSES to head a declared-names block when neither side declares any',
      fn: async () => {
        const shown = shownFor({ subject: SUBJECT, },);
        expect(shown.includes('DECLARED NAMES',),).toBe(false,);
      },
    },),
  ],
},);
