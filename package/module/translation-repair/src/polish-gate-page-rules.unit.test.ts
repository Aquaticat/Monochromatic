/**
 Guards ledger S12 and the polish half of S15: the polish gate reads the page
 rules every other candidate sheet reads.

 The consolidate gate read the apparatus rule, the declared-names rules, the
 community renderings and the dispute note before approving a base; the polish
 gate deciding whether a rewrite of that base ships read none of them, so a
 polish dropping apparatus, respelling a declared name, losing a community word
 or restoring a disputed reading answered to a sheet that had never heard of
 the rule. No candidate-weighing sheet told a judge what a line-structured
 original asks, so a polish merging verse lines could win on naturalness.

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { buildConsolidationPolishGateMessages, } from '../dist/final/node/index.mjs';

/**
 A slice whose polish loses the community word for 自切.
 */
const subject = {
  sourceText: '那只猫讲起自切的经历时，朋友们都安静地听着。',
  archiveText: 'When the cat told of her self-surgery, her friends listened quietly.',
  baseText: 'When the cat told of her self-surgery, her friends listened quietly.',
  polishedText: 'When the cat spoke of her operation, her friends sat in silence.',
  identityContext: '- name: ORIGINAL declares "猫猫", TRANSLATION declares "Mimi"',
  archiveDisputeNote: 'ARCHIVE RENDERING DISPUTED: the adjudicators accepted 1 claim(s) about the tabby.',
} as const;

/**
 Both halves of a sheet, joined.

 @param lineStructured - whether the line rule governs the slice

 @returns System text and user text of a comparative sheet
 */
function sheetFor({ lineStructured, }: { readonly lineStructured: boolean; },): {
  readonly system: string;
  readonly user: string;
} {
  /**
   Messages one judge is sent.
   */
  const messages = buildConsolidationPolishGateMessages({
    subject: {
      ...subject,
      lineStructured,
      mode: { kind: 'comparative', },
    },
  },);
  return {
    system: messages.at(0,)?.content ?? '',
    user: messages.at(1,)?.content ?? '',
  };
}

await describe({
  name: 'the polish gate reads the page rules (ledger S12, S15)',
  children: [
    it({
      name: 'CARRIES the apparatus rule in the sheet\'s own words, not "the existing translation"',
      fn: async () => {
        const { system, } = sheetFor({ lineStructured: false, },);
        expect(system,).toContain('PAGE APPARATUS IS KEPT. Apparatus the archive rendering carries',);
        expect(system,).toContain('WHAT HAPPENED IS NEVER APPARATUS',);
      },
    },),
    it({
      name: 'CARRIES the declared-names rules the contest reads',
      fn: async () => {
        const { system, } = sheetFor({ lineStructured: false, },);
        expect(system,).toContain('DECLARED NAMES ARE ATTESTED FACTS',);
        expect(system,).toContain('OUTRANK the archive rendering where it uses another spelling',);
      },
    },),
    it({
      name: 'SHOWS the dispute note the consolidate gate read, fenced',
      fn: async () => {
        const { user, } = sheetFor({ lineStructured: false, },);
        /**
         Heading line of the dispute block.
         */
        const heading = user.split('\n',).find(function isHeading(line,): boolean {
          return line.includes(' ARCHIVE RENDERING DISPUTED ',);
        },) ?? '';
        /**
         Fence the heading opens with.
         */
        const fence = heading.split(' ',).at(0,) ?? '';
        expect(fence.length,).toBeGreaterThan(0,);
        expect(heading,).toBe(`${fence} ARCHIVE RENDERING DISPUTED ${fence}`,);
        expect(user,).toContain(`${heading}\n${subject.archiveDisputeNote}\n${fence}\n`,);
      },
    },),
    it({
      name: 'NAMES the candidate losing the community word',
      fn: async () => {
        const { user, } = sheetFor({ lineStructured: false, },);
        expect(user,).toContain('COMMUNITY RENDERINGS, evidence to weigh, not a verdict:',);
        expect(user,).toContain('- CANDIDATE "polished" carries none of the community\'s renderings of 自切',);
        expect(user.includes('CANDIDATE "base" carries none',),).toBe(false,);
      },
    },),
    it({
      name: 'TELLS the judge what a line-structured original asks, and only where the rule governs',
      fn: async () => {
        expect(sheetFor({ lineStructured: true, },).system,).toContain('THE ORIGINAL IS LINE-STRUCTURED',);
        expect(sheetFor({ lineStructured: true, },).system,).toContain('is ONE line whose English is already',);
        expect(sheetFor({ lineStructured: false, },).system.includes('THE ORIGINAL IS LINE-STRUCTURED',),).toBe(false,);
      },
    },),
  ],
},);
