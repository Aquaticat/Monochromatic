/**
 * Tests for the sheet asking a producer to consolidate one slice.
 *
 * WHAT THIS FILE EXISTS TO STOP. A producer told only that two renderings exist
 * picks one. The whole reason this stage exists is that at least one slice of
 * the eight-entry reading had each lane right about a DIFFERENT part of the same
 * passage, so the sheet has to say that taking one clause from each is allowed,
 * and has to say that where the candidates agree they may both be wrong.
 *
 * It also has to present the judges' findings as claims. Obeying a false finding
 * introduces a defect this pipeline authored itself.
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
  buildConsolidateMessages,
  type ConsolidateSubject,
} from '../dist/final/node/index.mjs';

/**
 * Subject with only what every call must carry.
 */
const bare: ConsolidateSubject = {
  sourceText: '猫在窗台上睡觉。',
  incumbentText: 'The cat sleeps on the sill, purring.',
  repairText: 'The cat sleeps on the window sill.',
  translateText: 'The cat is napping on the ledge.',
  ballots: [],
};

/**
 * Joins the content of every message with one role.
 *
 * JOINED RATHER THAN INDEXED, because indexing a message out of the array would
 * need a non-null assertion in every case.
 *
 * @param subject - what the producer is shown
 *
 * @param role - which side of the exchange to read
 *
 * @returns That role's content, joined
 *
 * @example
 * ```ts
 * const sheet = partFor({ subject: bare, role: 'system', },);
 * ```
 */
function partFor(
  {
    subject,
    role,
  }: {
    readonly subject: ConsolidateSubject;
    readonly role: 'system' | 'user';
  },
): string {
  return buildConsolidateMessages({ subject, },)
    .filter(function hasRole(message,): boolean {
      return message.role === role;
    },)
    .map(function contentOf(message,): string {
      return message.content;
    },)
    .join('\n',);
}

/**
 * Instructions the producer is given.
 *
 * @param subject - what the producer is shown
 *
 * @returns System content
 *
 * @example
 * ```ts
 * const sheet = sheetFor({ subject: bare, },);
 * ```
 */
function sheetFor(
  { subject, }: { readonly subject: ConsolidateSubject; },
): string {
  return partFor({
    subject,
    role: 'system',
  },);
}

/**
 * Evidence the producer is shown.
 *
 * SEPARATE FROM THE SHEET, because the instructions name DECLARED NAMES as a
 * rule whether or not this slice has any, so a test asking whether the block was
 * rendered would pass on the rule's own wording.
 *
 * @param subject - what the producer is shown
 *
 * @returns User content
 *
 * @example
 * ```ts
 * const shown = shownFor({ subject: bare, },);
 * ```
 */
function shownFor(
  { subject, }: { readonly subject: ConsolidateSubject; },
): string {
  return partFor({
    subject,
    role: 'user',
  },);
}

await describe({
  name: buildConsolidateMessages.name,
  children: [
    it({
      name: 'tells the producer that agreement between candidates can be wrong',
      fn: async () => {
        // THE INHERITED-INVENTION CASE. Where the archive invented something no
        // critic flagged, both lanes carry it and agree.
        expect(sheetFor({ subject: bare, },),)
          .toContain('where they agree they may both be wrong',);
      },
    },),
    it({
      name: 'licenses taking one clause from one candidate and the next from the other',
      fn: async () => {
        expect(sheetFor({ subject: bare, },),)
          .toContain('one clause from one candidate and the next from the other',);
      },
    },),
    it({
      name: 'presents the judge findings as claims to check, not as facts',
      fn: async () => {
        const sheet = sheetFor({ subject: bare, },);
        expect(sheet,).toContain('CLAIMS, NOT FACTS',);
        expect(sheet,).toContain('ignore any the ORIGINAL does not support',);
      },
    },),
    it({
      name: 'makes the page\'s shape the structural standard, not the original\'s',
      fn: async () => {
        // MEASURED, NOT ASSUMED. On the first calibration slice the Chinese is
        // one paragraph and the archive is a block quote plus an attribution
        // line, and a stage that matched the original flattened both into one.
        const sheet = sheetFor({ subject: bare, },);
        expect(sheet,).toContain('KEEP THE SHAPE OF THE PAGE',);
        expect(sheet,).toContain('the page\'s shape wins',);
      },
    },),
    it({
      name: 'asks for the translate lane\'s own reply shape',
      fn: async () => {
        expect(sheetFor({ subject: bare, },),)
          .toContain('{"translation": "..."}',);
      },
    },),
    it({
      name: 'shows the original, the archive rendering and both candidates',
      fn: async () => {
        const shown = shownFor({ subject: bare, },);
        expect(shown,).toContain(bare.sourceText,);
        expect(shown,).toContain(bare.incumbentText,);
        expect(shown,).toContain(bare.repairText,);
        expect(shown,).toContain(bare.translateText,);
      },
    },),
    it({
      name: 'REFUSES to head a findings block when no judge was heard',
      fn: async () => {
        const shown = shownFor({ subject: bare, },);
        expect(shown.includes('WHAT THE JUDGES FOUND',),).toBe(false,);
      },
    },),
    it({
      name: 'carries the judges\' own words when ballots were heard',
      fn: async () => {
        const shown = shownFor({
          subject: {
            ...bare,
            ballots: [
              {
                choice: 'repair',
                unsupported: [ 'translate', ],
                unsupportedRaw: [ 'translate invents a ledge', ],
                dropped: [],
                droppedRaw: [],
                reason: 'the original says sill',
              },
            ],
          },
        },);
        expect(shown,).toContain('WHAT THE JUDGES FOUND',);
        expect(shown,).toContain('translate invents a ledge',);
      },
    },),
    it({
      name: 'REFUSES to head blocks for evidence this slice does not have',
      fn: async () => {
        const shown = shownFor({ subject: bare, },);
        expect(shown.includes('DECLARED NAMES',),).toBe(false,);
        expect(shown.includes('WHAT THE PICTURES HERE SAY',),).toBe(false,);
      },
    },),
    it({
      name: 'shows declared names and picture readings when the slice has them',
      fn: async () => {
        const shown = shownFor({
          subject: {
            ...bare,
            identityContext: 'name: Mimi',
            pictureContext: 'a photograph of a tabby on a fence',
          },
        },);
        expect(shown,).toContain('name: Mimi',);
        expect(shown,).toContain('a photograph of a tabby on a fence',);
      },
    },),
    it({
      name: 'ACCEPTS a line-structured chunk by carrying the verse rule',
      fn: async () => {
        const sheet = sheetFor({
          subject: {
            ...bare,
            lineStructured: true,
          },
        },);
        expect(sheet,).toContain('line-structured',);
      },
    },),
    it({
      name: 'REFUSES the verse rule on ordinary prose',
      fn: async () => {
        const sheet = sheetFor({ subject: bare, },);
        expect(sheet.includes('line-structured',),).toBe(false,);
      },
    },),
    it({
      name: 'ACCEPTS text carrying a fence by choosing a longer one',
      fn: async () => {
        const shown = shownFor({
          subject: {
            ...bare,
            repairText: '=====\nThe cat sleeps.\n=====',
          },
        },);
        expect(shown,).toContain('======',);
      },
    },),

    it({
      name: 'SAYS SO where a candidate is the archive rendering unchanged, so '
        + 'a producer counting how many texts agree counts one source once',
      fn: async () => {
        /**
         * Slice where the translate lane kept the incumbent, which happened at
         * 5 of the 13 bed slices across both lanes.
         */
        const kept: ConsolidateSubject = {
          ...bare,
          translateText: bare.incumbentText,
        };
        const shown = shownFor({ subject: kept, },);
        expect(shown,).toContain('CANDIDATE "translate", which is the ARCHIVE RENDERING unchanged',);
        // AND ONLY THAT ONE: the lane that did change something is named
        // plainly, or the note would say nothing.
        expect(shown,).toContain('CANDIDATE "repair" =',);
      },
    },),

    it({
      name: 'NAMES both candidates plainly where neither reproduces the archive',
      fn: async () => {
        const shown = shownFor({ subject: bare, },);
        expect(shown.includes('ARCHIVE RENDERING unchanged',),).toBe(false,);
      },
    },),
  ],
},);
