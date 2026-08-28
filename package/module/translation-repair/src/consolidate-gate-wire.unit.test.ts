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
      name: 'APPLIES YAML POLICY at final consolidation gate',
      fn: async () => {
        const system = buildConsolidateGateMessages({
          subject: {
            ...SUBJECT,
            syntax: 'front-matter',
          },
        },).at(0,)?.content ?? '';
        expect(system,).toContain('complete YAML front matter',);
        expect(system,).toContain('entry directory id',);
        expect(system,).toContain('name and info.alias are the same identity',);
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

/**
 * Original long enough for the size floor to pass, so a ratio is measured
 * rather than skipped.
 */
const SIZED_SOURCE = '猫睡在窗台上，看着一只蛾子飞过。'.repeat(6,);

/**
 * Archive rendering far longer than that original, which is the shape a
 * page-only region produces.
 */
const PAGE_HEAVY = 'the archive spells this out at length. '.repeat(30,);

/**
 * Rendering in proportion to the original, at roughly three times its size.
 */
const IN_PROPORTION = 'the cat slept on the sill and watched a moth. '.repeat(6,);

await describe({
  name: 'buildConsolidateGateMessages size note',
  children: [
    it({
      name: 'CARRIES the size note into the message when one rendering is far out of proportion, '
        + 'which is the only place the evidence can reach a judge',
      fn: async () => {
        const asked = buildConsolidateGateMessages({
          subject: {
            sourceText: SIZED_SOURCE,
            incumbentText: PAGE_HEAVY,
            consolidatedText: PAGE_HEAVY,
            standingText: IN_PROPORTION,
          },
        },).at(1,)?.content ?? '';

        expect(asked.includes('SIZE NOTE',),).toBe(true,);
        expect(asked.includes('CANDIDATE "consolidated"',),).toBe(true,);
      },
    },),

    it({
      name: 'LEAVES THE MESSAGE ALONE when every rendering is in proportion, so a judge reading a '
        + 'note knows it is about this passage rather than boilerplate',
      fn: async () => {
        const asked = buildConsolidateGateMessages({
          subject: {
            sourceText: SIZED_SOURCE,
            incumbentText: IN_PROPORTION,
            consolidatedText: IN_PROPORTION,
            standingText: IN_PROPORTION,
          },
        },).at(1,)?.content ?? '';

        expect(asked.includes('SIZE NOTE',),).toBe(false,);
      },
    },),

    it({
      name: 'CARRIES the reading for both directions in the policy, so the note is evidence a '
        + 'judge knows how to weigh rather than a number with no rule attached',
      fn: async () => {
        const policy = buildConsolidateGateMessages({
          subject: {
            sourceText: SIZED_SOURCE,
            incumbentText: IN_PROPORTION,
            consolidatedText: IN_PROPORTION,
            standingText: IN_PROPORTION,
          },
        },).at(0,)?.content ?? '';

        expect(policy.includes('FAR SHORTER',),).toBe(true,);
        expect(policy.includes('FAR LONGER',),).toBe(true,);
        expect(policy.includes('SIZE ALONE SETTLES NEITHER READING',),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: 'a list field the model did not write as a list',
  children: [
    it({
      name: 'KEEPS the choice and reads the field as an empty list, since a wrong type is not a wording and no '
        + 'wording of a finding may cost a voice',
      fn: async () => {
        /**
         * Reply whose list fields are a null and a bare word.
         */
        const reply: unknown = {
          choice: 'standing',
          unsupported: null,
          dropped: 'none',
          reason: 'the original supports it',
        };

        expect(isConsolidateGateWire(reply,),).toBe(true,);
        if (!isConsolidateGateWire(reply,))
          throw new Error('the guard refused the reply it just accepted',);

        /**
         * Ballot read off it.
         */
        const ballot = readConsolidateGateBallot({ wire: reply, },);

        expect(ballot.choice,).toBe('standing',);
        expect(ballot.unsupported,).toEqual([],);
        expect(ballot.unsupportedRaw,).toEqual([],);
        expect(ballot.dropped,).toEqual([],);
        expect(ballot.droppedRaw,).toEqual([],);
      },
    },),
  ],
},);
